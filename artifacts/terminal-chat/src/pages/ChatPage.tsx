import { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  text: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp | null;
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Message));
      setMessages(msgs);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user) return;

    setSending(true);
    setInput("");
    try {
      await addDoc(collection(db, "messages"), {
        text,
        uid: user.uid,
        displayName: user.displayName || "Anonymous",
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const formatTime = (ts: Timestamp | null) => {
    if (!ts) return "...";
    const d = ts.toDate();
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono flex flex-col">
      <div className="border-b border-green-800 bg-black px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-green-600 text-xs ml-2">termchat -- global-room -- 80x24</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-700">user: <span className="text-green-400">{user?.displayName}</span></span>
          <button
            onClick={handleLogout}
            className="text-red-500 hover:text-red-400 border border-red-900 hover:border-red-700 px-2 py-0.5 transition-colors"
          >
            [logout]
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
        <div className="text-green-700 text-xs mb-4 border-b border-green-900 pb-2">
          <div>Connected to: termchat://global-room</div>
          <div>Session started: {new Date().toLocaleString()}</div>
          <div>Type a message and press Enter to send.</div>
        </div>

        {messages.map((msg) => {
          const isOwn = msg.uid === user?.uid;
          return (
            <div key={msg.id} className="text-sm leading-relaxed group">
              <span className="text-green-800 select-none">[{formatTime(msg.createdAt)}] </span>
              {isOwn ? (
                <span className="text-cyan-400 font-bold">{msg.displayName}</span>
              ) : (
                <span className="text-yellow-400">{msg.displayName}</span>
              )}
              <span className="text-green-700">: </span>
              <span className={isOwn ? "text-cyan-300" : "text-green-300"}>{msg.text}</span>
            </div>
          );
        })}

        {messages.length === 0 && (
          <div className="text-green-800 text-sm italic">No messages yet. Be the first to say something.</div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-green-800 p-3 bg-black">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <span className="text-green-600 text-sm shrink-0">
            <span className="text-green-500">{user?.displayName?.split(" ")[0]?.toLowerCase() ?? "user"}</span>
            <span className="text-green-700">@termchat:~$</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Type a message..."
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-green-300 placeholder-green-800 text-sm caret-green-400"
          />
          {sending && <span className="text-green-700 text-xs animate-pulse">sending...</span>}
        </form>
      </div>
    </div>
  );
}
