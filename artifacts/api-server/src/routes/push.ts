import { Router } from "express";
import webpush from "web-push";

const router = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:termchat@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

router.get("/push/vapid-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post("/push/notify", async (req, res) => {
  const { subscriptions, notification } = req.body as {
    subscriptions: webpush.PushSubscription[];
    notification: { title: string; body: string; icon?: string; tag?: string; data?: Record<string, unknown> };
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
  const failed = results.filter((r) => r.status === "rejected").length;

  res.json({ sent, failed });
});

export default router;
