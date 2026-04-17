const crypto = require("crypto");
const https = require("https");

function b64u(buf) {
  return Buffer.from(buf).toString("base64url");
}
function db64u(s) {
  return Buffer.from(s, "base64url");
}
function hkdfExtract(salt, ikm) {
  return crypto.createHmac("sha256", salt).update(ikm).digest();
}
function hkdfExpand(prk, info, length) {
  const out = [];
  let prev = Buffer.alloc(0);
  for (let i = 1; out.reduce((s, b) => s + b.length, 0) < length; i++) {
    prev = crypto.createHmac("sha256", prk).update(prev).update(info).update(Buffer.from([i])).digest();
    out.push(prev);
  }
  return Buffer.concat(out).slice(0, length);
}

function buildVapidHeader(endpoint, vapidPublicKey, vapidPrivateKey, vapidEmail) {
  const u = new URL(endpoint);
  const audience = `${u.protocol}//${u.host}`;
  const exp = Math.floor(Date.now() / 1000) + 43200;

  const hdr = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pay = b64u(Buffer.from(JSON.stringify({ aud: audience, exp, sub: vapidEmail })));
  const sigInput = `${hdr}.${pay}`;

  const pubBytes = db64u(vapidPublicKey);
  const jwk = {
    kty: "EC", crv: "P-256",
    d: vapidPrivateKey,
    x: b64u(pubBytes.slice(1, 33)),
    y: b64u(pubBytes.slice(33, 65)),
  };
  const privKey = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const sig = crypto.sign("SHA256", Buffer.from(sigInput), { key: privKey, dsaEncoding: "ieee-p1363" });
  return `vapid t=${sigInput}.${b64u(sig)},k=${vapidPublicKey}`;
}

function encryptPayload(payloadStr, p256dhB64u, authB64u) {
  const authSecret = db64u(authB64u);
  const uaPublicKey = db64u(p256dhB64u);

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublicKey = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(uaPublicKey);
  const salt = crypto.randomBytes(16);

  const prkKey = hkdfExtract(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\x00"), uaPublicKey, serverPublicKey]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  const prk = hkdfExtract(salt, ikm);

  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\x00"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\x00"), 12);

  const plain = Buffer.concat([Buffer.from(payloadStr), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.allocUnsafe(4);
  rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([serverPublicKey.length]), serverPublicKey, ciphertext]);
}

function post(endpoint, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(endpoint);
    const req = https.request({
      hostname: u.hostname,
      port: u.port ? Number(u.port) : 443,
      path: u.pathname + u.search,
      method: "POST",
      headers,
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c.toString()));
      res.on("end", () => resolve({ status: res.statusCode, text: data }));
    });
    req.on("error", reject);
    if (body && body.length) req.write(body);
    req.end();
  });
}

async function sendPush(subscription, payloadStr, vapidPublicKey, vapidPrivateKey, vapidEmail) {
  const authorization = buildVapidHeader(subscription.endpoint, vapidPublicKey, vapidPrivateKey, vapidEmail);
  const hasKeys = subscription.keys && subscription.keys.p256dh && subscription.keys.auth;

  let body = Buffer.alloc(0);
  const headers = { Authorization: authorization, TTL: "60" };

  if (hasKeys && payloadStr) {
    body = encryptPayload(payloadStr, subscription.keys.p256dh, subscription.keys.auth);
    headers["Content-Type"] = "application/octet-stream";
    headers["Content-Encoding"] = "aes128gcm";
    headers["Content-Length"] = String(body.length);
  }

  const { status, text } = await post(subscription.endpoint, headers, body);
  if (status === 410 || status === 404) throw new Error(`Subscription expired (${status})`);
  if (status < 200 || status >= 300) throw new Error(`Push endpoint returned ${status}: ${text.slice(0, 200)}`);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
    const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:termchat@example.com";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(500).json({ error: "VAPID keys missing in environment variables" });
    }

    const { subscriptions, notification } = req.body;

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(400).json({ error: "No subscriptions provided" });
    }

    const payload = JSON.stringify(notification);
    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPush(sub, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

    return res.status(200).json({ sent, failed: errors.length, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Push] Error:", msg);
    return res.status(500).json({ error: msg });
  }
};
