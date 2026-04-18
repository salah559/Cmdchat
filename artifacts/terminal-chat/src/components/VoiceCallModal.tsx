import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { useUsers } from "@/hooks/useUsers";
import { useLang } from "@/contexts/LanguageContext";
import Avatar from "./Avatar";

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceCallModal() {
  const { callState, isMuted, callDuration, acceptCall, rejectCall, endCall, toggleMute } = useVoiceCall();
  const users = useUsers();
  const { lang } = useLang();

  if (callState.status === "idle") return null;

  const remoteUser = users.find(u => u.uid === callState.remoteUserId);
  const name = remoteUser?.displayName ?? (lang === "ar" ? "مستخدم" : "User");
  const photo = remoteUser?.photoURL ?? null;

  const isIncoming = callState.status === "incoming";
  const isCalling  = callState.status === "calling";
  const isActive   = callState.status === "active";
  const isError    = callState.status === "error";

  const labels = {
    ar: { calling: "جاري الاتصال...", incoming: "مكالمة واردة...", micError: "تعذّر الوصول إلى الميكروفون", dismiss: "إغلاق" },
    en: { calling: "Calling...", incoming: "Incoming call...", micError: "Microphone access denied", dismiss: "Dismiss" },
    fr: { calling: "Appel en cours...", incoming: "Appel entrant...", micError: "Accès micro refusé", dismiss: "Fermer" },
  }[lang];

  const statusText = isError
    ? (callState.errorMsg ?? labels.micError)
    : isIncoming ? labels.incoming
    : isCalling  ? labels.calling
    : fmt(callDuration);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0e0e0e] border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-5 w-72 shadow-2xl">

        {/* Pulse ring when active */}
        <div className="relative">
          {isActive && (
            <span className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
          )}
          <Avatar name={name} photoURL={photo} size="lg" />
        </div>

        {/* Name */}
        <div className="text-center">
          <p className="text-green-200 font-bold text-lg">{name}</p>
          <p className={`text-sm mt-1 font-mono ${
            isError   ? "text-red-400" :
            isActive  ? "text-green-400" :
            "text-green-700"
          }`}>
            {statusText}
          </p>
        </div>

        {/* ── ERROR state ── */}
        {isError && (
          <button
            onClick={endCall}
            className="mt-1 px-5 py-2 rounded-full bg-red-700/80 text-white text-sm active:scale-95 transition-transform"
          >
            {labels.dismiss}
          </button>
        )}

        {/* ── INCOMING state ── */}
        {isIncoming && (
          <div className="flex gap-6 mt-1">
            {/* Reject */}
            <button onClick={rejectCall} className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              <PhoneIcon className="w-6 h-6 text-white rotate-[135deg]" />
            </button>
            {/* Accept */}
            <button onClick={acceptCall} className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              <PhoneIcon className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* ── CALLING / ACTIVE state ── */}
        {(isCalling || isActive) && (
          <div className="flex gap-5 mt-1">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isMuted ? "bg-white/25 text-white" : "bg-white/8 text-green-700"
              }`}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>
            {/* End call */}
            <button onClick={endCall} className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
              <PhoneIcon className="w-6 h-6 text-white rotate-[135deg]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── icon helpers ── */
function PhoneIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}
