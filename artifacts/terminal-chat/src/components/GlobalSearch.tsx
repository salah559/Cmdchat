import { useState, useEffect, useRef } from "react";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import Avatar from "./Avatar";

interface GlobalSearchProps {
  onSelectRoom: (id: string) => void;
  onClose: () => void;
}

export default function GlobalSearch({ onSelectRoom, onClose }: GlobalSearchProps) {
  const { user } = useAuth();
  const { rooms } = useRooms();
  const users = useUsers();
  const { t, lang } = useLang();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const activeRooms = rooms.filter((r) => !r.archived);

  const results = query.trim()
    ? activeRooms.filter((r) => {
        const q = query.toLowerCase();
        if (r.type === "group") {
          return r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q) || r.lastMessage.toLowerCase().includes(q);
        }
        const otherId = r.members.find((m) => m !== user?.uid);
        const other = users.find((u) => u.uid === otherId);
        return other?.displayName.toLowerCase().includes(q) || r.lastMessage.toLowerCase().includes(q);
      })
    : [];

  const getRoomDisplay = (room: Room) => {
    if (room.type === "group") return { name: `# ${room.name}`, subtitle: room.description || room.lastMessage || "", photoURL: null, isGroup: true };
    const otherId = room.members.find((m) => m !== user?.uid);
    const other = users.find((u) => u.uid === otherId);
    return { name: other?.displayName ?? t.unknown, subtitle: room.lastMessage || t.startConversation, photoURL: other?.photoURL ?? null, isGroup: false };
  };

  const handleSelect = (roomId: string) => {
    onSelectRoom(roomId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <svg className="w-4 h-4 text-green-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.globalSearchPlaceholder}
            className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-800 text-sm"
          />
          <button onClick={onClose} className="text-green-800 hover:text-green-500 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto overscroll-contain">
          {query.trim() && results.length === 0 && (
            <div className="flex items-center justify-center py-10 text-green-900 text-sm">
              {t.noSearchResults}
            </div>
          )}
          {!query.trim() && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-green-900">
              <svg className="w-8 h-8 text-green-900/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-xs">{t.globalSearch}</p>
            </div>
          )}
          {results.map((room) => {
            const { name, subtitle, photoURL, isGroup } = getRoomDisplay(room);
            return (
              <button
                key={room.id}
                onClick={() => handleSelect(room.id)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/3 hover:bg-white/4 transition-colors text-left active:bg-green-950/20"
              >
                <div className="shrink-0">
                  {isGroup ? (
                    <div className="w-9 h-9 rounded-xl bg-green-900/25 border border-green-800/30 flex items-center justify-center">
                      <span className="text-green-600 font-bold text-sm font-mono">#</span>
                    </div>
                  ) : (
                    <Avatar name={name} photoURL={photoURL} size="sm" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-green-300 text-sm font-medium truncate">{name}</div>
                  {subtitle && <div className="text-green-800 text-xs truncate">{subtitle}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
