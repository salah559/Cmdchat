import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useUnread } from "@/hooks/useUnread";
import { useTheme } from "@/contexts/ThemeContext";
import { isSoundEnabled, toggleSound } from "@/lib/sounds";
import { useLang } from "@/contexts/LanguageContext";
import CreateGroupModal from "./CreateGroupModal";
import ProfileModal from "./ProfileModal";
import PushTestPanel from "./PushTestPanel";
import SettingsModal from "./SettingsModal";
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
  const { markRead, isUnread } = useUnread();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("channels");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [dmLoadingUid, setDmLoadingUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [showPushTest, setShowPushTest] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const groupRooms = rooms.filter((r) => r.type === "group");
  const dmRooms = rooms.filter((r) => r.type === "dm");
  const otherUsers = users.filter((u) => u.uid !== user?.uid);
  const onlineCount = otherUsers.filter((u) => u.status === "online").length;

  const safeTop = "env(safe-area-inset-top, 44px)";

  const handleSelectRoom = (roomId: string) => {
    markRead(roomId);
    onSelectRoom(roomId);
  };

  const handleDM = async (uid: string) => {
    if (dmLoadingUid) return;
    setDmLoadingUid(uid);
    const roomId = await openDM(uid);
    setDmLoadingUid(null);
    if (roomId) {
      markRead(roomId);
      onSelectRoom(roomId);
    }
  };

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundOn(next);
  };

  const getDMUser = (room: Room) => {
    const otherId = room.members.find((m) => m !== user?.uid);
    return users.find((u) => u.uid === otherId);
  };

  const formatTime = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    const d = ts.toDate();
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatLastSeen = (ts: { toDate: () => Date } | null): string => {
    if (!ts) return "Offline";
    const diff = Date.now() - ts.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredGroups = groupRooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const filteredDMs = dmRooms.filter((r) => {
    const other = getDMUser(r);
    return other?.displayName.toLowerCase().includes(search.toLowerCase());
  });
  const filteredUsers = otherUsers.filter((u) => u.displayName.toLowerCase().includes(search.toLowerCase()));

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: "channels",
      label: "Channels",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      ),
      badge: groupRooms.filter((r) => isUnread(r.id, r.lastMessageAt)).length || undefined,
    },
    {
      key: "dms",
      label: "Messages",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      badge: dmRooms.filter((r) => isUnread(r.id, r.lastMessageAt)).length || undefined,
    },
    {
      key: "users",
      label: "People",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      badge: onlineCount > 0 ? onlineCount : undefined,
    },
  ];

  return (
    <>
      <div className="h-full flex flex-col bg-[#0a0a0a]">

        {/* Header */}
        <div
          className="px-4 pb-3 bg-[#0a0a0a] border-b border-white/5 shrink-0"
          style={{ paddingTop: `calc(${safeTop} + 8px)` }}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setProfileUid(user!.uid)}
              className="flex items-center gap-2.5 active:opacity-70 transition-opacity min-w-0"
            >
              <Avatar name={user?.displayName} photoURL={user?.photoURL} size="sm" />
              <div className="text-left min-w-0">
                <p className="text-green-300 font-semibold text-sm leading-tight truncate max-w-[120px]">{user?.displayName}</p>
                <p className="text-green-600 text-xs">● Online</p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {/* Settings */}
              <button
                onClick={() => setShowSettings(true)}
                title={t.settings}
                className="w-8 h-8 flex items-center justify-center text-green-700 hover:text-green-400 border border-green-900/50 hover:border-green-700/60 rounded-xl transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Sound toggle */}
              <button
                onClick={handleToggleSound}
                title={soundOn ? "Mute sounds" : "Unmute sounds"}
                className="w-8 h-8 flex items-center justify-center text-green-700 hover:text-green-400 border border-green-900/50 hover:border-green-700/60 rounded-xl transition-all active:scale-95"
              >
                {soundOn ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M5 9l4-4v14l-4-4H2V9h3z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                title={isDark ? "Light mode" : "Dark mode"}
                className="w-8 h-8 flex items-center justify-center text-green-700 hover:text-green-400 border border-green-900/50 hover:border-green-700/60 rounded-xl transition-all active:scale-95"
              >
                {isDark ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* New channel */}
              {tab === "channels" && (
                <button
                  onClick={() => setShowCreateGroup(true)}
                  title="New channel"
                  className="w-8 h-8 flex items-center justify-center text-green-700 hover:text-green-400 border border-green-900/50 hover:border-green-700/60 rounded-xl transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}

              {/* Logout */}
              <button
                onClick={logout}
                title="Sign out"
                className="w-8 h-8 flex items-center justify-center text-red-900 hover:text-red-500 border border-red-900/30 hover:border-red-800/50 rounded-xl transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/6 rounded-xl px-3 py-2.5">
            <svg className="w-4 h-4 text-green-900 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-green-900 hover:text-green-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/5 bg-[#0a0a0a] shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all relative ${
                tab === t.key ? "text-green-400" : "text-green-900 hover:text-green-700"
              }`}
            >
              <div className="relative">
                {t.icon}
                {t.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-green-600 text-black text-[10px] font-bold flex items-center justify-center px-0.5">
                    {t.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{t.label}</span>
              {tab === t.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* List content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Channels */}
          {tab === "channels" && (
            <div>
              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-green-900 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-900/20 border border-green-900/30 flex items-center justify-center mb-4">
                    <span className="text-green-700 text-2xl font-bold font-mono">#</span>
                  </div>
                  <p className="text-sm font-medium text-green-800">No channels yet</p>
                  <p className="text-xs mt-1 mb-4">Create a channel to start a group conversation</p>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="px-5 py-2.5 border border-green-900/60 text-green-700 text-sm hover:text-green-500 hover:border-green-700/60 rounded-xl transition-all active:scale-95"
                  >
                    Create channel
                  </button>
                </div>
              ) : (
                filteredGroups.map((room) => {
                  const unread = isUnread(room.id, room.lastMessageAt) && room.id !== activeRoomId;
                  return (
                    <button
                      key={room.id}
                      onClick={() => handleSelectRoom(room.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/3 transition-colors active:bg-green-950/20 ${
                        activeRoomId === room.id ? "bg-green-950/15 border-l-2 border-l-green-600" : ""
                      }`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-green-900/25 border border-green-800/30 flex items-center justify-center shrink-0 relative">
                        <span className="text-green-600 font-bold text-lg font-mono">#</span>
                        {unread && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0a0a0a]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-semibold text-sm truncate ${unread ? "text-green-200" : "text-green-300"}`}>{room.name}</span>
                          <span className="text-green-900 text-xs shrink-0">{formatTime(room.lastMessageAt)}</span>
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${unread ? "text-green-600 font-medium" : "text-green-800"}`}>{room.lastMessage || "No messages yet"}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* DMs */}
          {tab === "dms" && (
            <div>
              {filteredDMs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-green-900 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-900/20 border border-green-900/30 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-green-800">No direct messages yet</p>
                  <p className="text-xs mt-1">Go to the People tab to start a conversation</p>
                </div>
              ) : (
                filteredDMs.map((room) => {
                  const other = getDMUser(room);
                  const unread = isUnread(room.id, room.lastMessageAt) && room.id !== activeRoomId;
                  return (
                    <button
                      key={room.id}
                      onClick={() => handleSelectRoom(room.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/3 transition-colors active:bg-green-950/20 ${
                        activeRoomId === room.id ? "bg-green-950/15 border-l-2 border-l-green-600" : ""
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar name={other?.displayName} photoURL={other?.photoURL} size="md" />
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${
                            other?.status === "online" ? "bg-green-500" : "bg-gray-700"
                          }`}
                        />
                        {unread && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#0a0a0a]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-semibold text-sm truncate ${unread ? "text-green-200" : "text-green-300"}`}>{other?.displayName ?? "Unknown"}</span>
                          <span className="text-green-900 text-xs shrink-0">{formatTime(room.lastMessageAt)}</span>
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${unread ? "text-green-600 font-medium" : "text-green-800"}`}>
                          {room.lastMessage || "Start a conversation"}
                        </div>
                        {other?.status !== "online" && other?.lastSeen && (
                          <div className="text-green-900 text-[10px] mt-0.5">
                            Last seen {formatLastSeen(other.lastSeen)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Users / People */}
          {tab === "users" && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/3">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_#22c55e]" />
                <span className="text-green-800 text-xs">{onlineCount} online · {otherUsers.length} total</span>
              </div>
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-green-900 px-6 text-center">
                  <p className="text-sm font-medium text-green-800">No other users yet</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.uid} className="flex items-center gap-3 px-4 py-3.5 border-b border-white/3">
                    <button onClick={() => setProfileUid(u.uid)} className="relative shrink-0 active:opacity-70 transition-opacity">
                      <Avatar name={u.displayName} photoURL={u.photoURL} size="md" />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${
                          u.status === "online" ? "bg-green-500" : "bg-gray-700"
                        }`}
                      />
                    </button>

                    <button onClick={() => setProfileUid(u.uid)} className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity">
                      <div className="text-green-300 font-semibold text-sm truncate">{u.displayName}</div>
                      <div className={`text-xs mt-0.5 ${u.status === "online" ? "text-green-600" : "text-green-900"}`}>
                        {u.status === "online" ? "● Online" : `○ ${formatLastSeen(u.lastSeen)}`}
                      </div>
                    </button>

                    <button
                      onClick={() => handleDM(u.uid)}
                      disabled={!!dmLoadingUid}
                      title="Send message"
                      className="w-10 h-10 rounded-2xl bg-green-900/25 border border-green-800/30 flex items-center justify-center text-green-600 hover:text-green-400 hover:bg-green-900/45 transition-all active:scale-95 disabled:opacity-40 shrink-0"
                    >
                      {dmLoadingUid === u.uid ? (
                        <span className="w-3.5 h-3.5 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(id) => { setShowCreateGroup(false); handleSelectRoom(id); }}
        />
      )}

      {profileUid && (
        <ProfileModal
          uid={profileUid}
          onClose={() => setProfileUid(null)}
          onSendMessage={async (uid) => {
            setProfileUid(null);
            const roomId = await openDM(uid);
            if (roomId) handleSelectRoom(roomId);
          }}
        />
      )}

      {showPushTest && <PushTestPanel onClose={() => setShowPushTest(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
