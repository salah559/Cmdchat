import { useState, useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";

interface ChatAreaProps {
  roomId: string | null;
  onBack: () => void;
}

export default function ChatArea({ roomId, onBack }: ChatAreaProps) {
  const { user } = useAuth();
  const { rooms } = useRooms();
  const users = useUsers();
  const { messages, sendMessage } = useMessages(roomId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const room: Room | undefined = rooms.find((r) => r.id === roomId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    setSending(true);
    await sendMessage(text);
    setSending(false);
    inputRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const formatTime = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    return ts.toDate().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  };

  const getRoomTitle = () => {
    if (!room) return "";
    if (room.type === "group") return `#${room.name}`;
    const otherId = room.members.find((m) => m !== user?.uid);
    const other = users.find((u) => u.uid === otherId);
    return other?.displayName ?? "DM";
  };

  const getOtherUser = () => {
    if (!room || room.type !== "dm") return null;
    const otherId = room.members.find((m) => m !== user?.uid);
    return users.find((u) => u.uid === otherId) ?? null;
  };

  const otherUser = getOtherUser();
  const handle = user?.displayName?.split(" ")[0]?.toLowerCase() ?? "user";

  if (!roomId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#050505] text-center px-6">
        <div className="space-y-4">
          <div className="text-green-700 text-4xl font-bold tracking-widest">TC</div>
          <div className="text-green-600 text-sm font-bold tracking-widest">TERMCHAT</div>
          <div className="text-green-900 text-xs space-y-1 mt-4">
            <div>Select a channel to start chatting</div>
            <div>or tap a user to send a direct message</div>
          </div>
          <div className="text-green-800 text-lg mt-6 animate-pulse">_</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <div className="px-4 py-3 border-b border-green-900/60 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden text-green-700 hover:text-green-400 text-sm transition-colors mr-1"
        >
          ← back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold text-sm truncate">{getRoomTitle()}</span>
            {otherUser && (
              <span className={`flex items-center gap-1 text-xs shrink-0 ${otherUser.status === "online" ? "text-green-500" : "text-green-900"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${otherUser.status === "online" ? "bg-green-500 shadow-[0_0_4px_#22c55e]" : "bg-green-900"}`}></span>
                {otherUser.status}
              </span>
            )}
          </div>
          {room?.type === "group" && (
            <div className="text-green-800 text-xs">{room.members.length} members</div>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
      >
        {messages.length === 0 && (
          <div className="text-green-900 text-xs italic text-center mt-8">
            No messages yet. Say something!
          </div>
        )}

        <div className="space-y-1">
          {messages.map((msg, i) => {
            const isOwn = msg.uid === user?.uid;
            const prev = messages[i - 1];
            const showHeader = !prev || prev.uid !== msg.uid;
            const showTime = showHeader || (i > 0 && (() => {
              const cur = msg.createdAt?.toDate().getTime() ?? 0;
              const pre = messages[i-1].createdAt?.toDate().getTime() ?? 0;
              return cur - pre > 300000;
            })());

            return (
              <div key={msg.id} className={showHeader && i > 0 ? "mt-3" : ""}>
                {showHeader && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={`text-xs font-bold ${isOwn ? "text-cyan-500" : "text-yellow-500"}`}>
                      {isOwn ? "you" : msg.displayName}
                    </span>
                    <span className="text-green-900 text-[10px]">{formatTime(msg.createdAt)}</span>
                  </div>
                )}
                <div className={`flex gap-2 ${isOwn ? "flex-row-reverse md:flex-row" : ""}`}>
                  <div className={`
                    max-w-[85%] px-3 py-2 text-sm leading-relaxed break-words
                    ${isOwn
                      ? "bg-green-900/25 text-cyan-300 border border-green-900/50 ml-auto md:ml-0"
                      : "bg-black/50 text-green-300 border border-green-900/30"}
                  `}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} className="h-1" />
      </div>

      <div className="border-t border-green-900/60 px-3 py-3 shrink-0 bg-[#050505]">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 border border-green-900/60 bg-black/40 px-3 py-2.5">
            <span className="text-green-800 text-xs shrink-0 hidden sm:block">{handle}$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              placeholder="Type a message..."
              className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900/60 text-sm caret-green-400 font-mono min-w-0"
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="border border-green-800 text-green-600 hover:text-green-400 hover:border-green-600 px-4 py-2.5 text-sm transition-all disabled:opacity-30 shrink-0 active:scale-95"
          >
            {sending ? "·" : "→"}
          </button>
        </form>
      </div>
    </div>
  );
}
