import { useEffect, useRef } from "react";
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
  const audioRef = useRef<HTMLAudioElement>(null);

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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Background Blur Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={isError ? endCall : undefined} />
      
      {/* Hidden audio for WebRTC - although context handles its own, keeping one here can be a fallback */}
      <audio ref={audioRef} autoPlay style={{ display: "none" }} />

      <div className="relative bg-app-surface/90 border border-white/10 rounded-[40px] p-10 flex flex-col items-center gap-8 w-full max-w-[320px] shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* User Profile Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {isActive && (
              <div className="absolute -inset-4 rounded-full bg-blue-500/10 animate-ping duration-[2000ms]" />
            )}
            <div className={`p-1.5 rounded-full border-2 transition-colors duration-500 ${isActive ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" : "border-white/5"}`}>
              <Avatar name={name} photoURL={photo} size="lg" />
            </div>
            {(isCalling || isIncoming) && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-4 border-app-surface animate-bounce">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
                </svg>
              </div>
            )}
          </div>

          <div className="text-center">
            <h2 className="text-white font-bold text-2xl tracking-tight">{name}</h2>
            <div className={`mt-2 flex items-center justify-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isError ? "bg-red-500/10 text-red-400" :
              isActive ? "bg-blue-500/10 text-blue-400" :
              "bg-white/5 text-app-text-dim"
            }`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
              {statusText}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-6">
          {isError ? (
            <button
              onClick={endCall}
              className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all active:scale-95"
            >
              {labels.dismiss}
            </button>
          ) : isIncoming ? (
            <>
              <button
                onClick={rejectCall}
                className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
              >
                <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
                </svg>
              </button>
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:scale-105 transition-all active:scale-90"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
                </svg>
              </button>
            </>
          ) : (
            <>
              {(isCalling || isActive) && (
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                    isMuted 
                      ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {isMuted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              )}
              <button
                onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:scale-105 transition-all active:scale-90"
              >
                <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z" />
                </svg>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
