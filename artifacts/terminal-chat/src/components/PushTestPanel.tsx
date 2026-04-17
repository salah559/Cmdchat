import { useState, useEffect } from "react";
import { usePushNotifications } from "@/contexts/PushNotificationContext";
import type { PushStatus } from "@/contexts/PushNotificationContext";

const statusLabel: Record<PushStatus, { text: string; color: string }> = {
  idle: { text: "جاري التهيئة...", color: "text-yellow-500" },
  requesting: { text: "طلب الإذن...", color: "text-yellow-600" },
  "no-permission": { text: "الإذن مرفوض", color: "text-red-500" },
  "no-vapid": { text: "مفتاح VAPID مفقود", color: "text-red-500" },
  subscribing: { text: "جاري الاشتراك...", color: "text-yellow-600" },
  saving: { text: "جاري الحفظ...", color: "text-yellow-600" },
  ready: { text: "جاهز ✓", color: "text-green-500" },
  error: { text: "خطأ", color: "text-red-500" },
};

interface PingResult {
  ok: boolean;
  status: number;
  body: string;
}

export default function PushTestPanel({ onClose }: { onClose: () => void }) {
  const { testPushToSelf, pushStatus, pushError } = usePushNotifications();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);

  const status = statusLabel[pushStatus];

  // Auto-ping on open
  useEffect(() => {
    runPing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPing() {
    setPinging(true);
    setPing(null);
    try {
      const res = await fetch("/api/ping");
      const text = await res.text();
      setPing({ ok: res.ok, status: res.status, body: text.slice(0, 200) });
    } catch (e) {
      setPing({ ok: false, status: 0, body: String(e) });
    }
    setPinging(false);
  }

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testPushToSelf();
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-t-2xl p-5 pb-8 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <h2 className="text-green-300 font-bold text-base mb-4 font-mono">اختبار الإشعارات</h2>

        {/* Server ping */}
        <div className="bg-white/5 border border-white/8 rounded-xl p-3.5 mb-3 space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-green-800 text-xs font-semibold">فحص الخادم (Vercel API)</span>
            <button onClick={runPing} className="text-xs text-green-700 underline">
              {pinging ? "..." : "إعادة الفحص"}
            </button>
          </div>
          {ping ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-green-800 text-xs">/api/ping</span>
                <span className={`text-xs font-bold ${ping.ok ? "text-green-500" : "text-red-500"}`}>
                  {ping.ok ? `✓ ${ping.status}` : `✗ ${ping.status || "لا استجابة"}`}
                </span>
              </div>
              {!ping.ok && (
                <div className="text-red-400 text-[10px] bg-red-900/20 rounded px-2 py-1 break-all font-mono">
                  {ping.body}
                </div>
              )}
              {ping.ok && (
                <div className="text-green-700 text-[10px] bg-green-900/10 rounded px-2 py-1 break-all font-mono">
                  {ping.body}
                </div>
              )}
            </>
          ) : (
            <span className="text-green-900 text-xs">جاري الفحص...</span>
          )}
        </div>

        {/* Push status */}
        <div className="bg-white/5 border border-white/8 rounded-xl p-3.5 mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-green-800 text-xs">حالة الإشعارات</span>
            <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
          </div>

          {pushError && (
            <div className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2 break-all font-mono">
              {pushError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-green-800 text-xs">دعم المتصفح</span>
            <span className={`text-xs font-semibold ${"PushManager" in window ? "text-green-500" : "text-red-500"}`}>
              {"PushManager" in window ? "مدعوم ✓" : "غير مدعوم ✗"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-green-800 text-xs">إذن الإشعارات</span>
            <span className={`text-xs font-semibold ${
              Notification.permission === "granted"
                ? "text-green-500"
                : Notification.permission === "denied"
                ? "text-red-500"
                : "text-yellow-600"
            }`}>
              {Notification.permission === "granted"
                ? "ممنوح ✓"
                : Notification.permission === "denied"
                ? "مرفوض ✗"
                : "لم يُطلب بعد"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-green-800 text-xs">مفتاح VAPID</span>
            <span className={`text-xs font-semibold ${import.meta.env.VITE_VAPID_PUBLIC_KEY ? "text-green-500" : "text-red-500"}`}>
              {import.meta.env.VITE_VAPID_PUBLIC_KEY
                ? `موجود (${import.meta.env.VITE_VAPID_PUBLIC_KEY.slice(0, 8)}...)`
                : "مفقود ✗"}
            </span>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`rounded-xl px-3.5 py-3 mb-3 text-xs border break-all font-mono ${
            testResult.ok
              ? "bg-green-900/20 border-green-800/40 text-green-400"
              : "bg-red-900/20 border-red-800/40 text-red-400"
          }`}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.message}
          </div>
        )}

        {testResult?.ok && (
          <p className="text-green-900 text-xs mb-3 text-center">
            اضغط زر الهوم وانتظر ثوانٍ لترى الإشعار
          </p>
        )}

        {/* Test button */}
        <button
          onClick={handleTest}
          disabled={testing || pushStatus !== "ready"}
          className="w-full py-3 bg-green-900/30 border border-green-800/50 text-green-400 font-semibold rounded-xl text-sm hover:bg-green-900/50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
              جاري الإرسال...
            </span>
          ) : (
            "إرسال إشعار تجريبي لنفسي"
          )}
        </button>

        {pushStatus === "no-permission" && (
          <p className="text-red-400 text-xs text-center mt-3">
            افتح إعدادات Android → التطبيقات → Chrome → الإشعارات وفعّلها
          </p>
        )}

        {pushStatus === "no-vapid" && (
          <p className="text-red-400 text-xs text-center mt-3">
            أضف VITE_VAPID_PUBLIC_KEY في إعدادات Vercel وأعد النشر
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 text-green-800 text-sm hover:text-green-600 transition-colors"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
