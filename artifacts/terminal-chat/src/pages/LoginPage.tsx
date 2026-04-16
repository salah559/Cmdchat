import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError("Sign-in failed. Please allow popups and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-svh bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div
        className={`w-full max-w-sm transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-green-900/30 border border-green-800/60 flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(0,200,0,0.08)]">
            <span className="text-green-400 font-bold text-2xl font-mono">TC</span>
          </div>
          <h1 className="text-green-300 font-bold text-2xl font-mono tracking-wide">TermChat</h1>
          <p className="text-green-800 text-sm mt-2 text-center">Secure terminal-style messaging</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 border border-red-900 bg-red-950/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-green-800 text-green-300 py-4 px-6 text-sm font-mono font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-green-800 border-t-green-400 rounded-full animate-spin"></span>
              <span>Connecting...</span>
            </div>
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4ade80" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#22c55e" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#16a34a" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#15803d" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/5"></div>
          <span className="text-green-900 text-xs">TERMCHAT v2.4</span>
          <div className="flex-1 h-px bg-white/5"></div>
        </div>

        <p className="text-green-900 text-xs text-center mt-4 leading-relaxed">
          By continuing, you agree to our terms.<br/>
          Your data is stored securely in Firebase.
        </p>
      </div>
    </div>
  );
}
