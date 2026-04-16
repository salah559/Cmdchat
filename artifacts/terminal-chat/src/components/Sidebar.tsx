import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers, ChatUser } from "@/hooks/useUsers";
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

  const handleDM = async (uid: string) => {
    setDmLoadingUid(uid);
    const roomId = await openDM(uid);
    setDmLoadingUid(null);
    if (roomId) onSelectRoom(roomId);
  };

  const getDMName = (room: Room) => {
    const otherId = room.members.find((m) => m !== user?.uid);
    const other = users.find((u) => u.uid === otherId);
    return other?.displayName ?? "Unknown";
  };

  const getDMStatus = (room: Room): "online" | "offline" => {
    const otherId = room.members.find((m) => m !== user?.uid);
    const other = users.find((u) => u.uid === otherId);
    return other?.status ?? "offline";
  };

  const otherUsers = users.filter((u) => u.uid !== user?.uid);

  return (
    <>
      <div className="w-60 shrink-0 border-r border-green-900 bg-black flex flex-col h-full select-none">
        <div className="px-3 py-3 border-b border-green-900">
          <div className="text-green-600 text-xs uppercase tracking-widest mb-1">TermChat</div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.8)]"></span>
            <span className="text-green-300 text-xs truncate">{user?.displayName}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-green-700 text-xs uppercase tracking-widest">Channels</span>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="text-green-700 hover:text-green-400 text-xs transition-colors"
                title="Create group"
              >
                [+]
              </button>
            </div>
            {groupRooms.length === 0 && (
              <div className="text-green-900 text-xs italic pl-2 py-1">No channels yet</div>
            )}
            {groupRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1 text-sm transition-colors rounded-none ${
                  activeRoomId === room.id
                    ? "bg-green-900/40 text-green-300"
                    : "text-green-600 hover:text-green-400 hover:bg-green-950/50"
                }`}
              >
                <span className="text-green-700">#</span>
                <span className="truncate">{room.name}</span>
              </button>
            ))}
          </div>

          <div className="px-3 pt-3 pb-1">
            <div className="text-green-700 text-xs uppercase tracking-widest mb-1">Direct Messages</div>
            {dmRooms.length === 0 && (
              <div className="text-green-900 text-xs italic pl-2 py-1">Click a user below</div>
            )}
            {dmRooms.map((room) => {
              const status = getDMStatus(room);
              return (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1 text-sm transition-colors ${
                    activeRoomId === room.id
                      ? "bg-green-900/40 text-green-300"
                      : "text-green-600 hover:text-green-400 hover:bg-green-950/50"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status === "online" ? "bg-green-500" : "bg-green-900"}`}></span>
                  <span className="truncate">{getDMName(room)}</span>
                </button>
              );
            })}
          </div>

          <div className="px-3 pt-3 pb-1">
            <div className="text-green-700 text-xs uppercase tracking-widest mb-1">
              Online — {otherUsers.filter((u) => u.status === "online").length}/{otherUsers.length}
            </div>
            {otherUsers.map((u) => (
              <button
                key={u.uid}
                onClick={() => dmLoadingUid === u.uid ? null : handleDM(u.uid)}
                disabled={dmLoadingUid === u.uid}
                className="w-full text-left flex items-center gap-2 px-2 py-1 text-sm text-green-700 hover:text-green-400 hover:bg-green-950/50 transition-colors disabled:opacity-50"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                    u.status === "online"
                      ? "bg-green-500 shadow-[0_0_4px_rgba(74,222,128,0.8)]"
                      : "bg-green-900"
                  }`}
                ></span>
                <span className="truncate text-xs">{u.displayName}</span>
                {dmLoadingUid === u.uid && <span className="text-green-800 text-xs ml-auto">...</span>}
              </button>
            ))}
            {otherUsers.length === 0 && (
              <div className="text-green-900 text-xs italic pl-2 py-1">No other users yet</div>
            )}
          </div>
        </div>

        <div className="px-3 py-2 border-t border-green-900">
          <button
            onClick={logout}
            className="w-full text-left text-xs text-red-800 hover:text-red-500 transition-colors py-1"
          >
            [logout]
          </button>
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
