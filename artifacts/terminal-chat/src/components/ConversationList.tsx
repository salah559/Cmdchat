import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import CreateGroupModal from "./CreateGroupModal";
import Avatar from "./Avatar";

interface ConversationListProps {
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
}

type Tab = "channels" | "dms" | "users";

export default function ConversationList({ activeRoomId, onSelectRoom }: ConversationListProps) {
  const { user, logout } = useAuth();
  const { rooms, openDM } = useRooms();
  const users = useUsers();
  const [tab, setTab] = useState<Tab>("channels");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [dmLoadingUid, setDmLoadingUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const groupRooms = rooms.filter((r) => r.type === "group");
  const dmRooms = rooms.filter((r) => r.type === "dm");
  const otherUsers = users.filter((u) => u.uid !== user?.uid);
  const onlineCount = otherUsers.filter((u) => u.status === "online").length;

  const handleDM = async (uid: string) => {
    if (dmLoadingUid) return;
    setDmLoadingUid(uid);
    const roomId = await openDM(uid);
    setDmLoadingUid(null);
    if (roomId) onSelectRoom(roomId);
  };

  const getDMUser = (room: Room) => {
    const otherId = room.members.find((m) => m !== user?.uid);
    return users.find((u) => u.uid === otherId);
  };

  const formatTime = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    const d = ts.toDate();
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredGroups = groupRooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDMs = dmRooms.filter((r) => {
    const other = getDMUser(r);
    return other?.displayName.toLowerCase().includes(search.toLowerCase());
  });
  const filteredUsers = otherUsers.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="h-full flex flex-col bg-[#0a0a0a]">
        {/* Header */}
        <div className="px-4 pt-12 pb-3 bg-[#0a0a0a] border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-green-400 font-bold text-xl tracking-wide">TermChat</h1>
              <p className="text-green-800 text-xs mt-0.5">{user?.displayName}</p>
            </div>
            <div className="flex items-center gap-2">
              {tab === "channels" && (
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="w-9 h-9 flex items-center justify-center text-green-600 hover:text-green-400 border border-green-900 hover:border-green-700 transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              <button
                onClick={logout}
                className="w-9 h-9 flex items-center justify-center text-red-900 hover:text-red-500 border border-red-900/40 hover:border-red-800 transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/8 px-3 py-2.5">
            <svg className="w-4 h-4 text-green-900 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900 text-sm font-mono"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#0a0a0a] shrink-0">
          {(["channels", "dms", "users"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                tab === t
                  ? "text-green-400 border-b-2 border-green-500"
                  : "text-green-900 hover:text-green-700"
              }`}
            >
              {t === "users" ? `Users (${onlineCount})` : t}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {tab === "channels" && (
            <div>
              {filteredGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-green-900">
                  <div className="text-4xl mb-3">#</div>
                  <p className="text-sm">No channels yet</p>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="mt-4 px-4 py-2 border border-green-800 text-green-700 text-sm hover:text-green-500 hover:border-green-600 transition-all"
                  >
                    Create first channel
                  </button>
                </div>
              )}
              {filteredGroups.map((room) => (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/3 active:bg-green-950/30 transition-colors ${
                    activeRoomId === room.id ? "bg-green-950/20" : ""
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center shrink-0">
                    <span className="text-green-500 font-bold text-lg">#</span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-green-300 font-semibold text-sm truncate">{room.name}</span>
                      <span className="text-green-900 text-xs ml-2 shrink-0">{formatTime(room.lastMessageAt)}</span>
                    </div>
                    <div className="text-green-800 text-xs truncate mt-0.5">
                      {room.lastMessage || "No messages yet"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === "dms" && (
            <div>
              {filteredDMs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-green-900">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-sm">No direct messages yet</p>
                  <p className="text-xs mt-1">Go to Users tab to start a conversation</p>
                </div>
              )}
              {filteredDMs.map((room) => {
                const other = getDMUser(room);
                return (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom(room.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/3 active:bg-green-950/30 transition-colors ${
                      activeRoomId === room.id ? "bg-green-950/20" : ""
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={other?.displayName} photoURL={other?.photoURL} size="md" />
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${other?.status === "online" ? "bg-green-500" : "bg-gray-700"}`}></span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-green-300 font-semibold text-sm truncate">{other?.displayName ?? "Unknown"}</span>
                        <span className="text-green-900 text-xs ml-2 shrink-0">{formatTime(room.lastMessageAt)}</span>
                      </div>
                      <div className="text-green-800 text-xs truncate mt-0.5">
                        {room.lastMessage || "Start a conversation"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "users" && (
            <div>
              <div className="px-4 py-2 text-green-900 text-xs">
                {onlineCount} online of {otherUsers.length} users
              </div>
              {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-green-900">
                  <p className="text-sm">No other users yet</p>
                </div>
              )}
              {filteredUsers.map((u) => (
                <button
                  key={u.uid}
                  onClick={() => handleDM(u.uid)}
                  disabled={dmLoadingUid === u.uid}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/3 active:bg-green-950/30 transition-colors disabled:opacity-50"
                >
                  <div className="relative shrink-0">
                    <Avatar name={u.displayName} photoURL={u.photoURL} size="md" />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${u.status === "online" ? "bg-green-500" : "bg-gray-700"}`}></span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-green-300 font-semibold text-sm truncate">{u.displayName}</div>
                    <div className={`text-xs mt-0.5 ${u.status === "online" ? "text-green-600" : "text-green-900"}`}>
                      {u.status === "online" ? "● Online" : "○ Offline"}
                    </div>
                  </div>
                  <div className="text-green-800 text-xs shrink-0">
                    {dmLoadingUid === u.uid ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(id) => { setShowCreateGroup(false); onSelectRoom(id); }}
        />
      )}
    </>
  );
}
