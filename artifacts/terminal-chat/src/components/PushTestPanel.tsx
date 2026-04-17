import { useState } from "react";
import { usePushNotifications } from "@/contexts/PushNotificationContext";
import type { PushStatus } from "@/contexts/PushNotificationContext";

const statusLabel: Record<PushStatus, { text: string; color: string }> = {
  idle: { text: "جاري التهيئة...", color: "text-green-900" },
  requesting: { text: "طلب الإذن...", color: "text-yellow-600" },
  "no-permission": { text: "الإذن مرفوض", color: "text-red-500" },
  "no-vapid": { text: "مفتاح VAPID مفقود", color: "text-red-500" },
  subscribing: { text: "جاري الاشتراك...", color: "text-yellow-600" },
  saving: { text: "جاري الحفظ...", color: "text-yellow-600" },
  ready: { text: "جاهز ✓", color: "text-green-500" },
  error: { text: "خطأ", color: "text-red-500" },
};

export default function PushTestPanel({ onClose }: { onClose: () => void }) {
  const { testPushToSelf, pushStatus, pushError } = usePushNotifications();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testPushToSelf();
    setTestResult(result);
    setTesting(false);
  };

  const status = statusLabel[pushStatus];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-t-2xl p-5 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <h2 className="text-green-300 font-bold text-base mb-4 font-mono">اختبار الإشعارات</h2>

        {/* Status */}
        <div className="bg-white/5 border border-white/8 rounded-xl p-3.5 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-green-800 text-xs">حالة الإشعارات</span>
            <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
          </div>

          {pushError && (
            <div className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2 break-all">
              {pushError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-green-800 text-xs">دعم المتصفح</span>
            <span className={`text-xs font-semibold ${
              "PushManager" in window ? "text-green-500" : "text-red-500"
            }`}>
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
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`rounded-xl px-3.5 py-3 mb-4 text-xs border ${
            testResult.ok
              ? "bg-green-900/20 border-green-800/40 text-green-400"
              : "bg-red-900/20 border-red-800/40 text-red-400"
          }`}>
            {testResult.ok ? "✓ " : "✗ "}
            {testResult.message}
          </div>
        )}

        {/* Instructions */}
        {testResult?.ok && (
          <p className="text-green-900 text-xs mb-4 text-center">
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
            افتح إعدادات Android ← التطبيقات ← Chrome ← الإشعارات وفعّلها
          </p>
        )}

        {pushStatus === "no-vapid" && (
          <p className="text-red-400 text-xs text-center mt-3">
            تأكد من إضافة VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY في إعدادات Vercel
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
