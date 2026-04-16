import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import CreateGroupModal from "./CreateGroupModal";

interface SidebarProps {
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
}

export default function Sidebar({ activeRoomId, onSelectRoom }: SidebarProps) {
  const { user, logout } = useAuth();
  const { rooms, openDM } = useRooms();
  const users = useUsers();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [dmLoadingUid, setDmLoadingUid] = useState<string | null>(null);

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
            <div>
              <div className="text-green-500 font-bold text-sm tracking-wider">TERMCHAT</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span>
                <span className="text-green-600 text-xs truncate max-w-[140px]">{user?.displayName}</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-red-900 hover:text-red-500 text-xs border border-red-900/50 hover:border-red-700 px-2 py-1 transition-all"
            >
              exit
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-3 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-800 text-[10px] uppercase tracking-[0.15em]">Channels</span>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="text-green-700 hover:text-green-400 text-xs border border-green-900/50 hover:border-green-700 px-2 py-0.5 transition-all"
              >
                + new
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
                <div className="text-green-900 text-xs px-3 py-2 italic">No channels yet</div>
              )}
            </div>
          </div>

          {dmRooms.length > 0 && (
            <div className="px-3 pt-5">
              <div className="text-green-800 text-[10px] uppercase tracking-[0.15em] mb-2">Direct Messages</div>
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
              Users — <span className="text-green-600">{onlineCount} online</span>
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
                  {dmLoadingUid === u.uid ? (
                    <span className="text-green-900 text-xs animate-pulse">...</span>
                  ) : (
                    <span className="text-green-900 text-[10px] opacity-0 group-hover:opacity-100">msg →</span>
                  )}
                </button>
              ))}
              {otherUsers.length === 0 && (
                <div className="text-green-900 text-xs px-3 py-2 italic">No other users yet</div>
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
    </>
  );
}
