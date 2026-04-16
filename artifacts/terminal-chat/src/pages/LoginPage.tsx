import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const BOOT_LINES = [
  "TERMINAL CHAT OS v2.4.1",
  "Copyright (C) 2024 TermChat Systems",
  "──────────────────────────────────────",
  "Initializing kernel modules...",
  "Loading network stack... OK",
  "Mounting filesystem... OK",
  "Starting auth daemon... OK",
  "Connecting to chat server... OK",
  "──────────────────────────────────────",
  "System ready.",
  "",
  "Welcome to TermChat. Please authenticate.",
];

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [lines, setLines] = useState<string[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        const line = BOOT_LINES[i] ?? "";
        setLines((prev) => [...prev, line]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowPrompt(true), 300);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError("ERR: Authentication failed. Check popup blocker.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="border border-green-700 bg-black/90 rounded-none p-6 shadow-[0_0_30px_rgba(0,255,0,0.15)]">
          <div className="mb-4 text-xs text-green-600 flex items-center gap-2">
            <span className="text-green-400">●</span>
            <span className="text-green-400">●</span>
            <span className="text-green-400">●</span>
            <span className="ml-2">termchat -- bash -- 80x24</span>
          </div>
          <div className="space-y-1 text-sm leading-relaxed min-h-[280px]">
            {lines.filter((l) => l !== undefined && l !== null).map((line, i) => (
              <div key={i} className={line.startsWith("\u2500") ? "text-green-700" : line === "" ? "h-3" : "text-green-400"}>
                {line || "\u00A0"}
              </div>
            ))}
            {showPrompt && (
              <div className="mt-4 space-y-4">
                <div className="text-green-300">
                  <span className="text-green-600">root@termchat:~$</span> <span className="text-yellow-400">auth --provider=google</span>
                </div>
                {error && (
                  <div className="text-red-400 text-xs">{error}</div>
                )}
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="group flex items-center gap-3 border border-green-600 bg-black hover:bg-green-950 text-green-400 hover:text-green-300 px-5 py-3 text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="animate-pulse">Authenticating...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span>[ SIGN IN WITH GOOGLE ]</span>
                    </>
                  )}
                </button>
                <div className="text-green-700 text-xs">
                  <span className="animate-pulse">█</span> Waiting for authentication...
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 text-center text-green-800 text-xs">
          TermChat v2.4.1 — Secure Terminal Messaging
        </div>
      </div>
    </div>
  );
}
