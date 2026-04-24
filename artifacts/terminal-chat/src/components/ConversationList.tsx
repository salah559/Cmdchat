import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useUnread } from "@/hooks/useUnread";
import { useTheme } from "@/contexts/ThemeContext";
import { useLang } from "@/contexts/LanguageContext";
import CreateGroupModal from "./CreateGroupModal";
import ProfileModal from "./ProfileModal";
import SettingsModal from "./SettingsModal";
import GlobalSearch from "./GlobalSearch";
import Avatar from "./Avatar";

interface ConversationListProps {
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
}

type Tab = "channels" | "dms" | "users";

export default function ConversationList({ activeRoomId, onSelectRoom }: ConversationListProps) {
  const { user, logout } = useAuth();
  const { rooms, openDM, unarchiveRoom } = useRooms();
  const users = useUsers();
  const { markRead, isUnread } = useUnread();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang } = useLang();
  const [tab, setTab] = useState<Tab>("channels");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [dmLoadingUid, setDmLoadingUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const activeRooms = rooms.filter((r) => !r.archived);
  const archivedRooms = rooms.filter((r) => r.archived);
  const groupRooms = activeRooms.filter((r) => r.type === "group");
  const dmRooms = activeRooms.filter((r) => r.type === "dm");
  const otherUsers = users.filter((u) => u.uid !== user?.uid);
  const onlineCount = otherUsers.filter((u) => u.status === "online").length;
  const currentUser = users.find((u) => u.uid === user?.uid);

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

  const getDMUser = (room: Room) => {
    const otherId = room.members.find((m) => m !== user?.uid);
    return users.find((u) => u.uid === otherId);
  };

  const formatTime = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    const d = ts.toDate();
    const now = new Date();
    const locale = lang === "ar" ? "ar-SA" : lang === "fr" ? "fr-FR" : "en-US";
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  const formatLastSeen = (ts: { toDate: () => Date } | null): string => {
    if (!ts) return t.offline;
    const diff = Date.now() - ts.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.justNow;
    if (mins < 60) return `${mins}${t.minsAgo}`;
    const hours = Math.floor(mins / 60);
    const locale = lang === "ar" ? "ar-SA" : lang === "fr" ? "fr-FR" : "en-US";
    if (hours < 24) return `${hours}${t.hoursAgo}`;
    return ts.toDate().toLocaleDateString(locale, { month: "short", day: "numeric" });
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
      label: t.channels,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      ),
      badge: groupRooms.filter((r) => isUnread(r.id, r.lastMessageAt)).length || undefined,
    },
    {
      key: "dms",
      label: t.directMessages,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      badge: dmRooms.filter((r) => isUnread(r.id, r.lastMessageAt)).length || undefined,
    },
    {
      key: "users",
      label: t.users,
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
      <div className="h-full flex flex-col bg-app border-r border-white/5 font-sans" dir={lang === "ar" ? "rtl" : "ltr"} onClick={() => setShowHeaderMenu(false)}>

        {/* Header */}
        <div
          className="px-4 pb-3 bg-app-surface border-b border-white/5 shrink-0"
          style={{ paddingTop: `calc(${safeTop} + 8px)` }}
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setProfileUid(user!.uid)}
              className="flex items-center gap-3 active:opacity-70 transition-opacity min-w-0 group"
            >
              <div className="relative shrink-0">
                <Avatar name={user?.displayName} photoURL={user?.photoURL} size="sm" />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-app-surface bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-white font-bold text-[15px] leading-tight truncate max-w-[120px]">{user?.displayName}</p>
                <p className="text-app-text-dim text-[11px] font-medium">{t.online2}</p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {/* New channel - visible only on channels tab */}
              {tab === "channels" && (
                <button
                  onClick={() => setShowCreateGroup(true)}
                  title={t.newChannelTitle}
                  className="w-8 h-8 flex items-center justify-center text-app-text-dim hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); }}
                  className="w-9 h-9 flex items-center justify-center text-app-text-dim hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {showHeaderMenu && (
                  <div
                    className="absolute end-0 top-full mt-2 bg-app-surface border border-white/10 rounded-2xl shadow-2xl z-50 min-w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setShowGlobalSearch(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-white/5 rounded-xl transition-colors text-start"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      {t.globalSearch}
                    </button>
                    <button
                      onClick={() => { setShowSettings(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-white/5 rounded-xl transition-colors text-start"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      {t.settings}
                    </button>
                    <button
                      onClick={() => { toggleTheme(); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-white/5 rounded-xl transition-colors text-start"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        {isDark ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                          </svg>
                        )}
                      </div>
                      {isDark ? t.lightMode : t.darkMode}
                    </button>
                    <div className="border-t border-white/5 mx-4 my-1"></div>
                    <button
                      onClick={() => { logout(); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-500 text-sm font-bold hover:bg-red-500/10 rounded-xl transition-colors text-start"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      {t.signOut}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-app-surface2 border border-white/5 rounded-xl px-3 py-2.5 shadow-inner">
            <svg className="w-4 h-4 text-app-text-dim shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="flex-1 bg-transparent outline-none text-white placeholder-app-text-dim text-sm font-medium"
            />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-2 py-2 gap-1 bg-app shrink-0">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`flex-1 flex items-center justify-center py-2.5 gap-2 rounded-xl transition-all relative ${
                tab === tabItem.key ? "bg-app-primary/10 text-app-primary" : "text-app-text-dim hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="relative">
                {tabItem.icon}
                {tabItem.badge !== undefined && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] rounded-full bg-app-primary text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-app shadow-lg">
                    {tabItem.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tight">{tabItem.label}</span>
            </button>
          ))}
        </div>

        {/* List content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Channels */}
          {tab === "channels" && (
            <div>
              {filteredGroups.length === 0 && archivedRooms.filter((r) => r.type === "group").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-green-900 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-900/20 border border-green-900/30 flex items-center justify-center mb-4">
                    <span className="text-green-700 text-2xl font-bold font-mono">#</span>
                  </div>
                  <p className="text-sm font-medium text-green-800">{t.noChannelsYet}</p>
                  <p className="text-xs mt-1 mb-4">{t.createChannelDesc}</p>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="px-5 py-2.5 border border-green-900/60 text-green-700 text-sm hover:text-green-500 hover:border-green-700/60 rounded-xl transition-all active:scale-95"
                  >
                    {t.createChannel}
                  </button>
                </div>
              ) : (
                <>
                  {filteredGroups.map((room) => {
                    const unread = isUnread(room.id, room.lastMessageAt) && room.id !== activeRoomId;
                    return (
                      <button
                        key={room.id}
                        onClick={() => handleSelectRoom(room.id)}
                        className={`w-full flex items-center gap-3 px-4 py-4 transition-all active:scale-[0.98] ${
                          activeRoomId === room.id ? "bg-app-primary/10" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-app-surface2 border border-white/5 flex items-center justify-center shrink-0 relative">
                          <span className="text-app-primary font-bold text-xl">#</span>
                          {unread && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-app-primary border-2 border-app shadow-lg" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-bold text-[15px] truncate ${unread ? "text-white" : "text-app-text-dim"}`}>{room.name}</span>
                            <span className="text-app-text-dim text-[11px] font-medium">{formatTime(room.lastMessageAt)}</span>
                          </div>
                          <div className={`text-xs truncate mt-1 ${unread ? "text-white font-semibold" : "text-app-text-dim"}`}>
                            {room.description ? (
                              <span className="opacity-70">{room.description}</span>
                            ) : (
                              room.lastMessage || t.noMessages2
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Archived channels section */}
                  {archivedRooms.filter((r) => r.type === "group").length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowArchived(!showArchived)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-green-900 hover:text-green-700 text-xs transition-colors border-b border-white/3"
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        {t.archivedChannels} ({archivedRooms.filter((r) => r.type === "group").length})
                      </button>
                      {showArchived && archivedRooms.filter((r) => r.type === "group").map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center gap-3 px-4 py-3 border-b border-white/3 bg-white/2"
                        >
                          <div className="w-9 h-9 rounded-xl bg-green-900/15 border border-green-900/20 flex items-center justify-center shrink-0">
                            <span className="text-green-900 font-bold text-sm font-mono">#</span>
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <span className="text-green-800 text-sm truncate">{room.name}</span>
                          </div>
                          <button
                            onClick={() => unarchiveRoom(room.id)}
                            className="text-green-900 hover:text-green-600 text-xs px-2 py-1 border border-green-900/30 rounded-lg transition-colors shrink-0"
                          >
                            {t.unarchiveChannel}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
                  <p className="text-sm font-medium text-green-800">{t.noDirectMessages}</p>
                  <p className="text-xs mt-1">{t.goToPeople}</p>
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
                          <span className={`font-semibold text-sm truncate ${unread ? "text-green-200" : "text-green-300"}`}>{other?.displayName ?? t.unknown}</span>
                          <span className="text-green-900 text-xs shrink-0">{formatTime(room.lastMessageAt)}</span>
                        </div>
                        {other?.statusText ? (
                          <div className="text-green-700 text-xs truncate mt-0.5">{other.statusText}</div>
                        ) : (
                          <div className={`text-xs truncate mt-0.5 ${unread ? "text-green-600 font-medium" : "text-green-800"}`}>
                            {room.lastMessage || t.startConversation}
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
                <span className="text-green-800 text-xs">{onlineCount} {t.online} · {otherUsers.length} {t.total}</span>
              </div>
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-green-900 px-6 text-center">
                  <p className="text-sm font-medium text-green-800">{t.noOtherUsers}</p>
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
                      {u.statusText ? (
                        <div className="text-green-700 text-xs mt-0.5 truncate">{u.statusText}</div>
                      ) : (
                        <div className={`text-xs mt-0.5 ${u.status === "online" ? "text-green-600" : "text-green-900"}`}>
                          {u.status === "online" ? `● ${t.online2}` : `○ ${formatLastSeen(u.lastSeen)}`}
                        </div>
                      )}
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showGlobalSearch && (
        <GlobalSearch
          onSelectRoom={(id) => { handleSelectRoom(id); }}
          onClose={() => setShowGlobalSearch(false)}
        />
      )}
    </>
  );
}
