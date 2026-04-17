import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ ok: true, time: new Date().toISOString(), env: {
    hasVapidPublic: !!process.env.VAPID_PUBLIC_KEY,
    hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
    hasVapidEmail: !!process.env.VAPID_EMAIL,
  }});
}
