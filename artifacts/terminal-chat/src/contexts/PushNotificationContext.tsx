import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

function getVapidPublicKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushStatus =
  | "idle"
  | "requesting"
  | "no-permission"
  | "no-vapid"
  | "subscribing"
  | "saving"
  | "ready"
  | "error";

interface PushNotificationContextValue {
  pushStatus: PushStatus;
  pushError: string;
  notifyMembers: (memberUids: string[], notification: { title: string; body: string; tag?: string }) => Promise<void>;
  testPushToSelf: () => Promise<{ ok: boolean; message: string }>;
}

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const registeredRef = useRef(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [pushError, setPushError] = useState<string>("");

  useEffect(() => {
    if (!user) {
      registeredRef.current = false;
      setPushStatus("idle");
      return;
    }
    if (registeredRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("error");
      setPushError("Push notifications not supported in this browser");
      return;
    }

    const register = async () => {
      try {
        setPushStatus("requesting");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setPushStatus("no-permission");
          return;
        }

        const registration = await navigator.serviceWorker.ready;

        setPushStatus("subscribing");
        const vapidKey = getVapidPublicKey();
        if (!vapidKey) {
          setPushStatus("no-vapid");
          setPushError("VAPID_PUBLIC_KEY not set in Vercel environment variables");
          return;
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidKey);

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe();
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });

        setPushStatus("saving");
        const subJson = subscription.toJSON();
        await updateDoc(doc(db, "users", user.uid), {
          pushSubscription: subJson,
        });

        setPushStatus("ready");
        registeredRef.current = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setPushStatus("error");
        setPushError(msg);
        console.error("[Push] Registration failed:", err);
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
        console.warn("[Push] Notify failed:", err);
      }
    },
    [user]
  );

  const testPushToSelf = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!user) return { ok: false, message: "Not logged in" };

    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const sub = snap.data()?.pushSubscription;

      if (!sub?.endpoint) {
        return { ok: false, message: "لا يوجد اشتراك - سجّل خروج وأعد الدخول" };
      }

      const res = await fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptions: [sub],
          notification: {
            title: "اختبار الإشعارات",
            body: "وصل الإشعار بنجاح! ✓",
            icon: "/icon-192.png",
            tag: "test-push",
            data: { url: "/" },
          },
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        return { ok: false, message: result.error ?? `Server error ${res.status}` };
      }
      if (result.failed > 0) {
        return { ok: false, message: `فشل: ${result.errors?.join(", ") ?? "unknown error"}` };
      }
      return { ok: true, message: "تم الإرسال! اضغط زر الهوم وانتظر الإشعار" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }, [user]);

  return (
    <PushNotificationContext.Provider value={{ pushStatus, pushError, notifyMembers, testPushToSelf }}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) throw new Error("usePushNotifications must be used inside PushNotificationProvider");
  return ctx;
}
