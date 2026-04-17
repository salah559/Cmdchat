import type { VercelRequest, VercelResponse } from "@vercel/node";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require("web-push") as typeof import("web-push");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
    const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:termchat@example.com";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      res.status(500).json({ error: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set in environment variables" });
      return;
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { subscriptions, notification } = req.body as {
      subscriptions: webpush.PushSubscription[];
      notification: { title: string; body: string; icon?: string; tag?: string; data?: object };
    };

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      res.status(400).json({ error: "No subscriptions provided" });
      return;
    }

    const payload = JSON.stringify(notification);
    const results = await Promise.allSettled(
      subscriptions.map((sub) => webpush.sendNotification(sub, payload))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason?.message ?? String((r as PromiseRejectedResult).reason));

    res.json({ sent, failed: errors.length, errors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Push Notify] Unhandled error:", msg);
    res.status(500).json({ error: msg });
  }
}
