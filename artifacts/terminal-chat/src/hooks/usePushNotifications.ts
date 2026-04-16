import { useEffect, useRef, useCallback } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-key");
  const data = await res.json();
  return data.publicKey as string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || registeredRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const register = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const registration = await navigator.serviceWorker.ready;
        const vapidKey = await getVapidPublicKey();

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }

        const subJson = subscription.toJSON();
        await updateDoc(doc(db, "users", user.uid), {
          pushSubscription: subJson,
        });

        registeredRef.current = true;
      } catch (err) {
        console.warn("Push registration failed:", err);
      }
    };

    register();
  }, [user]);

  const notifyMembers = useCallback(
    async (memberUids: string[], notification: { title: string; body: string; tag?: string }) => {
      if (!user) return;
      const others = memberUids.filter((uid) => uid !== user.uid);
      if (others.length === 0) return;

      const subscriptions: object[] = [];
      await Promise.all(
        others.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            const sub = snap.data()?.pushSubscription;
            if (sub?.endpoint) subscriptions.push(sub);
          } catch (_) {}
        })
      );

      if (subscriptions.length === 0) return;

      try {
        await fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptions,
            notification: {
              title: notification.title,
              body: notification.body,
              icon: "/icon-192.png",
              tag: notification.tag ?? "termchat",
              data: { url: "/" },
            },
          }),
        });
      } catch (err) {
        console.warn("Push notify failed:", err);
      }
    },
    [user]
  );

  return { notifyMembers };
}
