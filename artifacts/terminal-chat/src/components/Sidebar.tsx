import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useLang } from "@/contexts/LanguageContext";
import CreateGroupModal from "./CreateGroupModal";
import SettingsModal from "./SettingsModal";

interface SidebarProps {
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
}

export default function Sidebar({ activeRoomId, onSelectRoom }: SidebarProps) {
  const { user, logout } = useAuth();
  const { rooms, openDM } = useRooms();
  const users = useUsers();
  const { t } = useLang();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [dmLoadingUid, setDmLoadingUid] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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

  return (
    <>
      <div className="h-full bg-[#050505] border-r border-green-900/60 flex flex-col">
        <div className="px-4 py-4 border-b border-green-900/60">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-green-500 font-bold text-sm tracking-wider">TERMCHAT</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e] shrink-0"></span>
                <span className="text-green-600 text-xs truncate">{user?.displayName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Settings button */}
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-1 text-green-800 hover:text-green-400 text-xs border border-green-900/50 hover:border-green-700 px-2 py-1 transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t.settings}</span>
              </button>
              {/* Exit button */}
              <button
                onClick={logout}
                className="text-red-900 hover:text-red-500 text-xs border border-red-900/50 hover:border-red-700 px-2 py-1 transition-all active:scale-95"
              >
                {t.exit}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-3 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-800 text-[10px] uppercase tracking-[0.15em]">{t.channels}</span>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="text-green-700 hover:text-green-400 text-xs border border-green-900/50 hover:border-green-700 px-2 py-0.5 transition-all"
              >
                {t.newChannel}
              </button>
            </div>
            <div className="space-y-0.5">
              {groupRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all active:scale-[0.98] ${
                    activeRoomId === room.id
                      ? "bg-green-900/30 text-green-300 border-l-2 border-green-500"
                      : "text-green-700 hover:text-green-400 hover:bg-green-950/40 border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-green-800 text-xs">#</span>
                  <span className="truncate">{room.name}</span>
                  {room.lastMessage && activeRoomId !== room.id && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-600 shrink-0"></span>
                  )}
                </button>
              ))}
              {groupRooms.length === 0 && (
                <div className="text-green-900 text-xs px-3 py-2 italic">{t.noChannels}</div>
              )}
            </div>
          </div>

          {dmRooms.length > 0 && (
            <div className="px-3 pt-5">
              <div className="text-green-800 text-[10px] uppercase tracking-[0.15em] mb-2">{t.directMessages}</div>
              <div className="space-y-0.5">
                {dmRooms.map((room) => {
                  const other = getDMUser(room);
                  return (
                    <button
                      key={room.id}
                      onClick={() => onSelectRoom(room.id)}
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all active:scale-[0.98] ${
                        activeRoomId === room.id
                          ? "bg-green-900/30 text-green-300 border-l-2 border-green-500"
                          : "text-green-700 hover:text-green-400 hover:bg-green-950/40 border-l-2 border-transparent"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${other?.status === "online" ? "bg-green-500 shadow-[0_0_4px_#22c55e]" : "bg-green-900"}`}></span>
                      <span className="truncate">{other?.displayName ?? "Unknown"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-3 pt-5 pb-4">
            <div className="text-green-800 text-[10px] uppercase tracking-[0.15em] mb-2">
              {t.users} — <span className="text-green-600">{onlineCount} {t.online}</span>
            </div>
            <div className="space-y-0.5">
              {otherUsers.map((u) => (
                <button
                  key={u.uid}
                  onClick={() => handleDM(u.uid)}
                  disabled={dmLoadingUid === u.uid}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm text-green-800 hover:text-green-500 hover:bg-green-950/40 transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.status === "online" ? "bg-green-500 shadow-[0_0_4px_#22c55e]" : "bg-green-900"}`}></span>
                  <span className="truncate flex-1">{u.displayName}</span>
                  {dmLoadingUid === u.uid && (
                    <span className="text-green-900 text-xs animate-pulse">...</span>
                  )}
                </button>
              ))}
              {otherUsers.length === 0 && (
                <div className="text-green-900 text-xs px-3 py-2 italic">{t.noOtherUsers}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(id) => { setShowCreateGroup(false); onSelectRoom(id); }}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
