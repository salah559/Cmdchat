import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";
import * as https from "https";

// ── Helpers ────────────────────────────────────────────────────────────────

function b64u(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}
function db64u(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function hkdfExtract(salt: Buffer, ikm: Buffer): Buffer {
  return crypto.createHmac("sha256", salt).update(ikm).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const out: Buffer[] = [];
  let prev = Buffer.alloc(0);
  for (let i = 1; out.reduce((s, b) => s + b.length, 0) < length; i++) {
    prev = crypto.createHmac("sha256", prk).update(prev).update(info).update(Buffer.from([i])).digest();
    out.push(prev);
  }
  return Buffer.concat(out).slice(0, length);
}

// ── VAPID JWT signing (ES256 / ECDSA P-256) ────────────────────────────────

function buildVapidHeader(
  endpoint: string,
  vapidPublicKeyB64u: string,
  vapidPrivateKeyB64u: string,
  vapidEmail: string
): string {
  const { protocol, host } = new URL(endpoint);
  const audience = `${protocol}//${host}`;
  const exp = Math.floor(Date.now() / 1000) + 43200; // 12 h

  const jwtHeader = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const jwtPayload = b64u(Buffer.from(JSON.stringify({ aud: audience, exp, sub: vapidEmail })));
  const sigInput = `${jwtHeader}.${jwtPayload}`;

  const pubBytes = db64u(vapidPublicKeyB64u);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: vapidPrivateKeyB64u,
    x: b64u(pubBytes.slice(1, 33)),
    y: b64u(pubBytes.slice(33, 65)),
  };
  const privKey = crypto.createPrivateKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
  const sig = crypto.sign("SHA256", Buffer.from(sigInput), {
    key: privKey,
    dsaEncoding: "ieee-p1363",
  });

  return `vapid t=${sigInput}.${b64u(sig)},k=${vapidPublicKeyB64u}`;
}

// ── Payload encryption (RFC 8291 / aes128gcm) ─────────────────────────────

function encryptPayload(
  payloadStr: string,
  p256dhB64u: string,
  authB64u: string
): { body: Buffer; serverPublicKey: Buffer; salt: Buffer } {
  const authSecret = db64u(authB64u);
  const uaPublicKey = db64u(p256dhB64u); // 65-byte uncompressed client public key

  // Ephemeral server ECDH key pair
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublicKey = ecdh.getPublicKey(); // 65 bytes
  const sharedSecret = ecdh.computeSecret(uaPublicKey);

  const salt = crypto.randomBytes(16);

  // PRK_key = HKDF-Extract(auth_secret, shared_secret)
  const prkKey = hkdfExtract(authSecret, sharedSecret);

  // key_info = "WebPush: info\x00" || uaPublicKey || serverPublicKey
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\x00"), uaPublicKey, serverPublicKey]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);

  // PRK = HKDF-Extract(salt, ikm)
  const prk = hkdfExtract(salt, ikm);

  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\x00"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\x00"), 12);

  // Encrypt (plaintext + 0x02 delimiter for last record)
  const plain = Buffer.concat([Buffer.from(payloadStr), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

  // RFC 8188 body: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = Buffer.allocUnsafe(4);
  rs.writeUInt32BE(4096, 0);
  const body = Buffer.concat([salt, rs, Buffer.from([serverPublicKey.length]), serverPublicKey, ciphertext]);

  return { body, serverPublicKey, salt };
}

// ── HTTP POST to push service ──────────────────────────────────────────────

function post(
  endpoint: string,
  headers: Record<string, string>,
  body: Buffer
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(endpoint);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method: "POST",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => (data += c.toString()));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: data }));
      }
    );
    req.on("error", reject);
    if (body.length) req.write(body);
    req.end();
  });
}

// ── Main send function ─────────────────────────────────────────────────────

async function sendPush(
  subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } },
  payloadStr: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidEmail: string
): Promise<void> {
  const authorization = buildVapidHeader(subscription.endpoint, vapidPublicKey, vapidPrivateKey, vapidEmail);

  let body = Buffer.alloc(0);
  const headers: Record<string, string> = {
    Authorization: authorization,
    TTL: "60",
  };

  const hasKeys = subscription.keys?.p256dh && subscription.keys?.auth;
  if (hasKeys && payloadStr) {
    const encrypted = encryptPayload(payloadStr, subscription.keys!.p256dh!, subscription.keys!.auth!);
    body = Buffer.from(encrypted.body);
    headers["Content-Type"] = "application/octet-stream";
    headers["Content-Encoding"] = "aes128gcm";
    headers["Content-Length"] = String(body.length);
  }

  const { status, text } = await post(subscription.endpoint, headers, body);

  if (status === 410 || status === 404) {
    throw new Error(`Subscription expired (${status})`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Push endpoint returned ${status}: ${text.slice(0, 200)}`);
  }
}

// ── Vercel handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
    const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:termchat@example.com";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(500).json({ error: "VAPID keys missing in environment variables" });
    }

    const { subscriptions, notification } = req.body as {
      subscriptions: Array<{ endpoint: string; keys?: { p256dh?: string; auth?: string } }>;
      notification: { title: string; body: string; icon?: string; tag?: string; data?: object };
    };

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(400).json({ error: "No subscriptions provided" });
    }

    const payload = JSON.stringify(notification);

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendPush(sub, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL)
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

    return res.json({ sent, failed: errors.length, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Push] Unhandled error:", msg);
    return res.status(500).json({ error: msg });
  }
}
