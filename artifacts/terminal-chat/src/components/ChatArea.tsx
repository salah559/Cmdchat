import { useState, useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";

interface ChatAreaProps {
  roomId: string | null;
}

export default function ChatArea({ roomId }: ChatAreaProps) {
  const { user } = useAuth();
  const { rooms } = useRooms();
  const users = useUsers();
  const { messages, sendMessage } = useMessages(roomId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const room: Room | undefined = rooms.find((r) => r.id === roomId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [roomId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    await sendMessage(input);
    setInput("");
    setSending(false);
    inputRef.current?.focus();
  };

  const formatTime = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "--:--:--";
    const d = ts.toDate();
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const getRoomLabel = () => {
    if (!room) return "";
    if (room.type === "group") return `#${room.name}`;
    const otherId = room.members.find((m) => m !== user?.uid);
    const other = users.find((u) => u.uid === otherId);
    if (!other) return "@dm";
    return `@${other.displayName} — ${other.status === "online" ? "● online" : "○ offline"}`;
  };

  const getOtherUserStatus = () => {
    if (!room || room.type !== "dm") return null;
    const otherId = room.members.find((m) => m !== user?.uid);
    return users.find((u) => u.uid === otherId) ?? null;
  };

  const otherUser = getOtherUserStatus();
  const handle = user?.displayName?.split(" ")[0]?.toLowerCase() ?? "user";

  if (!roomId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-green-800 font-mono">
        <div className="text-center space-y-3">
          <div className="text-green-600 text-sm">TERMCHAT v2.4.1</div>
          <div className="text-xs space-y-1 text-green-900">
            <div>Select a channel or direct message to start chatting.</div>
            <div>Use [+] to create a new group channel.</div>
            <div>Click a user to open a direct message.</div>
          </div>
          <div className="text-green-800 text-xs mt-4 animate-pulse">█</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-4 py-2 border-b border-green-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-sm font-bold">{getRoomLabel()}</span>
          {otherUser && (
            <span className={`text-xs ${otherUser.status === "online" ? "text-green-500" : "text-green-900"}`}>
              {otherUser.status === "online" ? "● ONLINE" : "○ OFFLINE"}
            </span>
          )}
        </div>
        <span className="text-green-800 text-xs">{messages.length} messages</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 font-mono text-sm">
        {messages.length === 0 && (
          <div className="text-green-900 italic text-xs pt-2">
            No messages yet. Be the first to say something.
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.uid === user?.uid;
          const prevMsg = messages[i - 1];
          const showName = !prevMsg || prevMsg.uid !== msg.uid;

          return (
            <div key={msg.id} className={showName && i > 0 ? "mt-2" : ""}>
              {showName && (
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-xs font-bold ${isOwn ? "text-cyan-400" : "text-yellow-400"}`}>
                    {msg.displayName}
                  </span>
                  <span className="text-green-800 text-xs">{formatTime(msg.createdAt)}</span>
                </div>
              )}
              <div className="flex items-start gap-2 pl-0">
                {!showName && (
                  <span className="text-green-900 text-xs w-16 shrink-0 text-right select-none">
                    {formatTime(msg.createdAt)}
                  </span>
                )}
                <span className={`leading-snug ${isOwn ? "text-cyan-300" : "text-green-300"} ${!showName ? "" : ""}`}>
                  {msg.text}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-green-900 px-4 py-2 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <span className="text-xs shrink-0 text-green-700">
            <span className="text-green-500">{handle}</span>
            <span className="text-green-800">@termchat</span>
            <span className="text-green-600">:~$</span>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder={`Message ${getRoomLabel()}`}
            className="flex-1 bg-transparent border-none outline-none text-green-300 placeholder-green-900 text-sm caret-green-400 font-mono"
          />
          {sending && <span className="text-green-800 text-xs shrink-0 animate-pulse">sending</span>}
        </form>
      </div>
    </div>
  );
}
