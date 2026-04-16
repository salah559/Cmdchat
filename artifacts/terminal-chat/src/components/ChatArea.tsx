import { useState, useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import Avatar from "./Avatar";

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

  const room: Room | undefined = rooms.find((r) => r.id === roomId);

  const otherUser = (() => {
    if (!room || room.type !== "dm") return null;
    const otherId = room.members.find((m) => m !== user?.uid);
    return users.find((u) => u.uid === otherId) ?? null;
  })();

  const roomTitle = (() => {
    if (!room) return "";
    if (room.type === "group") return `# ${room.name}`;
    return otherUser?.displayName ?? "DM";
  })();

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages.length]);

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

  const formatDateLabel = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    const d = ts.toDate();
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  if (!roomId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-center px-6">
        <div className="w-20 h-20 rounded-full bg-green-900/20 border border-green-900/50 flex items-center justify-center mb-4">
          <span className="text-green-600 text-3xl font-bold">TC</span>
        </div>
        <h2 className="text-green-400 font-bold text-lg mb-2">TermChat</h2>
        <p className="text-green-800 text-sm">Select a conversation to start messaging</p>
      </div>
    );
  }

  let lastDateLabel = "";

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-3 pt-12 pb-3 bg-[#0f0f0f] border-b border-white/5 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="lg:hidden p-2 text-green-600 hover:text-green-400 active:scale-95 transition-all mr-1 -ml-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {room?.type === "dm" && otherUser ? (
          <div className="relative shrink-0">
            <Avatar name={otherUser.displayName} photoURL={otherUser.photoURL} size="sm" />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f0f0f] ${otherUser.status === "online" ? "bg-green-500" : "bg-gray-700"}`}></span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center shrink-0">
            <span className="text-green-500 font-bold text-sm">#</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-green-300 font-semibold text-sm truncate">{roomTitle}</div>
          {otherUser ? (
            <div className={`text-xs ${otherUser.status === "online" ? "text-green-600" : "text-green-900"}`}>
              {otherUser.status === "online" ? "Online" : "Offline"}
            </div>
          ) : room?.type === "group" ? (
            <div className="text-green-900 text-xs">{room.members.length} members</div>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-green-900 text-sm">
            <p>No messages yet</p>
            <p className="text-xs mt-1">Send the first message!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.uid === user?.uid;
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const isGroupStart = !prev || prev.uid !== msg.uid ||
            (msg.createdAt && prev.createdAt && msg.createdAt.toDate().getTime() - prev.createdAt.toDate().getTime() > 120000);
          const isGroupEnd = !next || next.uid !== msg.uid ||
            (msg.createdAt && next.createdAt && next.createdAt.toDate().getTime() - msg.createdAt.toDate().getTime() > 120000);

          const dateLabel = formatDateLabel(msg.createdAt);
          const showDate = dateLabel !== lastDateLabel;
          if (showDate) lastDateLabel = dateLabel;

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/5"></div>
                  <span className="text-green-900 text-xs px-2">{dateLabel}</span>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
              )}

              <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-3" : "mt-0.5"}`}>
                {/* Avatar — only for others, only at group end */}
                {!isOwn && room?.type === "group" && (
                  <div className="w-7 shrink-0 mb-1">
                    {isGroupEnd ? (
                      <Avatar name={msg.displayName} photoURL={msg.photoURL} size="sm" />
                    ) : null}
                  </div>
                )}

                <div className={`flex flex-col max-w-[78%] ${isOwn ? "items-end" : "items-start"}`}>
                  {isGroupStart && !isOwn && room?.type === "group" && (
                    <span className="text-green-700 text-xs font-semibold mb-1 ml-1">{msg.displayName}</span>
                  )}
                  <div className={`
                    px-3.5 py-2.5 text-sm leading-relaxed break-words
                    ${isOwn
                      ? `bg-green-800/50 text-green-100 ${isGroupStart ? "rounded-t-2xl" : ""} ${isGroupEnd ? "rounded-bl-2xl rounded-br-sm" : ""} ${!isGroupStart && !isGroupEnd ? "rounded-l-2xl rounded-r-sm" : ""} ${isGroupStart && isGroupEnd ? "rounded-2xl rounded-br-sm" : ""}`
                      : `bg-[#1a1a1a] text-green-200 border border-white/5 ${isGroupStart ? "rounded-t-2xl" : ""} ${isGroupEnd ? "rounded-br-2xl rounded-bl-sm" : ""} ${!isGroupStart && !isGroupEnd ? "rounded-r-2xl rounded-l-sm" : ""} ${isGroupStart && isGroupEnd ? "rounded-2xl rounded-bl-sm" : ""}`
                    }
                  `}>
                    {msg.text}
                  </div>
                  {isGroupEnd && (
                    <span className="text-green-900 text-[10px] mt-1 mx-1">{formatTime(msg.createdAt)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input */}
      <div className="px-3 py-3 pb-6 bg-[#0f0f0f] border-t border-white/5 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Avatar name={user?.displayName} photoURL={user?.photoURL} size="sm" />
          <div className="flex-1 flex items-center bg-white/5 border border-white/8 rounded-full px-4 py-2.5">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              placeholder="Message..."
              className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900 text-sm font-mono min-w-0"
              autoComplete="off"
              autoCapitalize="sentences"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0 ${
              input.trim() && !sending
                ? "bg-green-600 text-black hover:bg-green-500"
                : "bg-white/5 text-green-900"
            }`}
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-green-900 border-t-green-400 rounded-full animate-spin"></span>
            ) : (
              <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
