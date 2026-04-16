import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const BOOT_LINES = [
  { text: "TERMCHAT OS v2.4.1", type: "title" },
  { text: "──────────────────────", type: "divider" },
  { text: "Initializing kernel...", type: "info" },
  { text: "Loading auth module... OK", type: "ok" },
  { text: "Connecting to server... OK", type: "ok" },
  { text: "──────────────────────", type: "divider" },
  { text: "Ready. Please authenticate.", type: "info" },
];

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [visibleCount, setVisibleCount] = useState(0);
  const [showBtn, setShowBtn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visibleCount < BOOT_LINES.length) {
      const t = setTimeout(() => setVisibleCount((n) => n + 1), 150);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setShowBtn(true), 400);
      return () => clearTimeout(t);
    }
  }, [visibleCount]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError("Authentication failed. Check popup blocker.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-green-400 font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="border border-green-900 bg-black/80 shadow-[0_0_60px_rgba(0,255,0,0.06)]">
          <div className="border-b border-green-900/60 px-4 py-2.5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-900/70"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-900/70"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-800/70"></div>
            </div>
            <span className="text-green-900 text-xs ml-2">termchat — login</span>
          </div>

          <div className="p-6 space-y-1.5 min-h-[200px]">
            {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
              <div
                key={i}
                className={`text-sm leading-relaxed ${
                  line.type === "title" ? "text-green-300 font-bold" :
                  line.type === "divider" ? "text-green-900" :
                  line.type === "ok" ? "text-green-600" :
                  "text-green-700"
                }`}
              >
                {line.text}
              </div>
            ))}
            {visibleCount === BOOT_LINES.length && !showBtn && (
              <span className="text-green-600 animate-pulse">_</span>
            )}
          </div>

          {showBtn && (
            <div className="px-6 pb-6 space-y-4">
              <div className="text-green-800 text-xs">
                <span className="text-green-700">root@termchat:~$</span> auth --provider google
              </div>

              {error && (
                <div className="text-red-500 text-xs border border-red-900 px-3 py-2">
                  ERR: {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-green-700 hover:border-green-500 bg-green-900/10 hover:bg-green-900/20 text-green-400 hover:text-green-300 py-3.5 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="animate-pulse tracking-widest">authenticating...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="tracking-wider">SIGN IN WITH GOOGLE</span>
                  </>
                )}
              </button>

              <div className="text-green-900 text-[10px] text-center">
                Secure connection via Firebase Auth
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 text-center text-green-900 text-[10px] tracking-wider">
          TERMCHAT v2.4.1 — Terminal Messaging
        </div>
      </div>
    </div>
  );
}
