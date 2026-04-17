import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useRooms, Room } from "@/hooks/useRooms";
import { useLang } from "@/contexts/LanguageContext";
import Avatar from "./Avatar";

interface MembersModalProps {
  room: Room;
  onClose: () => void;
}

export default function MembersModal({ room, onClose }: MembersModalProps) {
  const { user } = useAuth();
  const users = useUsers();
  const { kickMember, updateRoom } = useRooms();
  const { t, lang } = useLang();

  const isAdmin = room.createdBy === user?.uid;
  const [editing, setEditing] = useState(false);
  const [roomName, setRoomName] = useState(room.name);
  const [roomDesc, setRoomDesc] = useState(room.description ?? "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);

  const members = room.members
    .map((uid) => users.find((u) => u.uid === uid))
    .filter(Boolean) as ReturnType<typeof useUsers>[number][];

  const handleSaveEdit = async () => {
    if (!roomName.trim()) return;
    setSavingEdit(true);
    await updateRoom(room.id, { name: roomName.trim().toLowerCase().replace(/\s+/g, "-"), description: roomDesc.trim() });
    setSavingEdit(false);
    setEditing(false);
  };

  const handleKick = async (uid: string) => {
    if (!confirm(t.confirmKick)) return;
    setKicking(uid);
    await kickMember(room.id, uid);
    setKicking(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-[#111] border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-white/15 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b border-white/5">
          <div className="min-w-0">
            <h2 className="text-green-300 font-bold text-base truncate">
              # {room.name}
            </h2>
            <p className="text-green-900 text-xs">{members.length} {t.members}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setEditing(!editing)}
                className={`p-1.5 rounded-lg transition-colors ${editing ? "text-green-400" : "text-green-800 hover:text-green-500"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="text-green-800 hover:text-green-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {editing && isAdmin && (
            <div className="space-y-3 pb-3 border-b border-white/5">
              <p className="text-green-900 text-xs uppercase tracking-wider">{t.editChannel}</p>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-green-300 text-sm outline-none focus:border-green-700 font-mono"
                placeholder={t.channelNameLabel}
              />
              <textarea
                value={roomDesc}
                onChange={(e) => setRoomDesc(e.target.value)}
                rows={2}
                placeholder={t.descPlaceholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-green-300 text-sm outline-none focus:border-green-700 resize-none placeholder-green-900"
              />
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !roomName.trim()}
                className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-black font-semibold text-sm rounded-xl transition-all disabled:opacity-40"
              >
                {savingEdit ? t.saving : t.saveProfile}
              </button>
            </div>
          )}

          {room.description && !editing && (
            <div className="text-green-800 text-xs bg-white/3 rounded-xl px-3 py-2 border border-white/5">
              {room.description}
            </div>
          )}

          <div>
            <p className="text-green-900 text-xs uppercase tracking-wider mb-3">{t.membersTitle}</p>
            <div className="space-y-1">
              {members.map((member) => {
                const isCreator = member.uid === room.createdBy;
                const isCurrentUser = member.uid === user?.uid;
                return (
                  <div
                    key={member.uid}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/3 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <Avatar name={member.displayName} photoURL={member.photoURL} size="sm" />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#111] ${member.status === "online" ? "bg-green-500" : "bg-gray-700"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-green-300 text-sm font-medium truncate">{member.displayName}</span>
                        {isCurrentUser && <span className="text-green-900 text-[10px]">({t.youLabel})</span>}
                        {isCreator && (
                          <span className="text-[10px] text-green-700 bg-green-900/30 px-1.5 py-0.5 rounded-full">{t.adminLabel}</span>
                        )}
                      </div>
                      {member.statusText && (
                        <p className="text-green-800 text-xs truncate">{member.statusText}</p>
                      )}
                    </div>
                    {isAdmin && !isCurrentUser && !isCreator && (
                      <button
                        onClick={() => handleKick(member.uid)}
                        disabled={kicking === member.uid}
                        className="text-red-900 hover:text-red-500 text-xs px-2 py-1 rounded-lg border border-red-900/30 hover:border-red-700/50 transition-all shrink-0 disabled:opacity-40"
                      >
                        {kicking === member.uid ? "..." : t.kickMember}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 shrink-0 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-green-800 text-sm hover:text-green-600 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
