import { useState, useEffect, useRef, useCallback } from "react";
import { useMessages, ReplyInfo } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useTyping } from "@/hooks/useTyping";
import { usePushNotifications } from "@/contexts/PushNotificationContext";
import { useLang } from "@/contexts/LanguageContext";
import { uploadImageToImgbb } from "@/lib/imgbb";
import { playMessageSound, playSentSound, isSoundEnabled } from "@/lib/sounds";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Avatar from "./Avatar";
import ProfileModal from "./ProfileModal";
import MembersModal from "./MembersModal";
import LinkPreview, { detectUrls } from "./LinkPreview";

interface ChatAreaProps {
  roomId: string | null;
  onBack: () => void;
  onRoomDeleted: () => void;
  showBack?: boolean;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

export default function ChatArea({ roomId, onBack, onRoomDeleted, showBack = false }: ChatAreaProps) {
  const { user } = useAuth();
  const { rooms, openDM, deleteRoom, pinMessage, unpinMessage, archiveRoom, unarchiveRoom } = useRooms();
  const users = useUsers();
  const { messages, sendMessage, editMessage, deleteMessage, toggleReaction, markRead } = useMessages(roomId);
  const { typingUsers, setTyping, clearTyping } = useTyping(roomId);
  const { notifyMembers } = usePushNotifications();
  const { t, lang } = useLang();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null);
  const [actionSheet, setActionSheet] = useState<{ msgId: string; isOwn: boolean } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [deleteMsgConfirm, setDeleteMsgConfirm] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCount = useRef(0);

  const SWIPE_THRESHOLD = 64;
  const swipeState = useRef<{
    msgId: string;
    startX: number;
    startY: number;
    isOwn: boolean;
    triggered: boolean;
    bubbleEl: HTMLElement | null;
    iconEl: HTMLElement | null;
  } | null>(null);

  const room: Room | undefined = rooms.find((r) => r.id === roomId);
  const isGroupAdmin = room?.type === "group" && room.createdBy === user?.uid;

  const otherUser = (() => {
    if (!room || room.type !== "dm") return null;
    const otherId = room.members.find((m) => m !== user?.uid);
    return users.find((u) => u.uid === otherId) ?? null;
  })();

  const roomTitle = (() => {
    if (!room) return "";
    if (room.type === "group") return room.name;
    return otherUser?.displayName ?? "DM";
  })();

  const pinnedMsg = room?.pinnedMessageId
    ? messages.find((m) => m.id === room.pinnedMessageId)
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [roomId]);

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.uid !== user?.uid && isSoundEnabled() && prevMsgCount.current > 0) {
        playMessageSound();
      }
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      if (lastMsg && lastMsg.uid !== user?.uid && roomId) {
        markRead(lastMsg.id);
      }
      // @mention detection
      if (lastMsg && lastMsg.uid !== user?.uid && user?.displayName) {
        const name = user.displayName.split(" ")[0].toLowerCase();
        if (lastMsg.text?.toLowerCase().includes(`@${name}`) || lastMsg.text?.toLowerCase().includes(`@${user.displayName.toLowerCase()}`)) {
          if (isSoundEnabled()) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          }
        }
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (!actionSheet) {
      setDeleteMsgConfirm(null);
      return;
    }
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-action-sheet]")) setActionSheet(null);
    };
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [actionSheet]);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = () => setShowMoreMenu(false);
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [showMoreMenu]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 100);
  }, [searchOpen]);

  useEffect(() => {
    if (editingMsgId) setTimeout(() => editInputRef.current?.focus(), 80);
  }, [editingMsgId]);

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !previewImage) || sending) return;
    const text = input;
    const imgUrl = previewImage;
    const reply = replyTo;
    setInput("");
    setPreviewImage(null);
    setReplyTo(null);
    setSending(true);
    await clearTyping();
    if (isSoundEnabled()) playSentSound();
    await sendMessage(text, imgUrl ?? undefined, reply ?? undefined);

    if (room && room.members.length > 1) {
      const senderName = user?.displayName ?? "Someone";
      const bodyText = imgUrl ? "📷 Photo" : (text.trim().slice(0, 80) || "Message");
      notifyMembers(room.members, {
        title: room.type === "dm" ? senderName : `${senderName} in ${roomTitle}`,
        body: bodyText,
        tag: `room-${roomId}`,
      });
    }

    setSending(false);
    inputRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) setTyping();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 32 * 1024 * 1024) { alert("Image must be under 32MB"); return; }
    setUploadingImage(true);
    try {
      const url = await uploadImageToImgbb(file);
      setPreviewImage(url);
    } catch {
      alert(t.failedUploadPhoto);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomId) return;
    setDeleting(true);
    await deleteRoom(roomId);
    setDeleting(false);
    setShowDeleteConfirm(false);
    onRoomDeleted();
  };

  const handleLongPressStart = useCallback((msgId: string, isOwn: boolean) => {
    longPressTimer.current = setTimeout(() => {
      setActionSheet({ msgId, isOwn });
    }, 450);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleSwipeStart = useCallback((e: React.TouchEvent, msgId: string, isOwn: boolean) => {
    const row = e.currentTarget as HTMLElement;
    const bubbleEl = row.querySelector<HTMLElement>("[data-bubble]");
    const iconEl = row.querySelector<HTMLElement>("[data-swipe-icon]");
    swipeState.current = { msgId, startX: e.touches[0].clientX, startY: e.touches[0].clientY, isOwn, triggered: false, bubbleEl, iconEl };
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    const state = swipeState.current;
    if (!state) return;
    const dx = e.touches[0].clientX - state.startX;
    const dy = e.touches[0].clientY - state.startY;
    if (Math.abs(dy) > Math.abs(dx) + 6 && Math.abs(dx) < 12) { swipeState.current = null; return; }
    const validDir = state.isOwn ? dx < 0 : dx > 0;
    if (!validDir) return;
    const capped = state.isOwn
      ? Math.max(dx, -SWIPE_THRESHOLD * 1.3)
      : Math.min(dx, SWIPE_THRESHOLD * 1.3);
    if (state.bubbleEl) { state.bubbleEl.style.transform = `translateX(${capped}px)`; state.bubbleEl.style.transition = "none"; }
    const progress = Math.min(Math.abs(capped) / SWIPE_THRESHOLD, 1);
    if (state.iconEl) { state.iconEl.style.opacity = String(progress); state.iconEl.style.transform = `scale(${0.5 + progress * 0.5})`; state.iconEl.style.transition = "none"; }
    if (!state.triggered && Math.abs(capped) >= SWIPE_THRESHOLD) {
      state.triggered = true;
      if ("vibrate" in navigator) navigator.vibrate(25);
    }
  }, []);

  const handleSwipeEnd = useCallback(() => {
    const state = swipeState.current;
    if (!state) return;
    if (state.triggered) {
      const msg = messages.find((m) => m.id === state.msgId);
      if (msg) { setReplyTo({ id: msg.id, text: msg.text, displayName: msg.displayName, imageUrl: msg.imageUrl }); setTimeout(() => inputRef.current?.focus(), 50); }
    }
    if (state.bubbleEl) { state.bubbleEl.style.transition = "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)"; state.bubbleEl.style.transform = "translateX(0)"; }
    if (state.iconEl) { state.iconEl.style.transition = "opacity 0.25s, transform 0.25s"; state.iconEl.style.opacity = "0"; state.iconEl.style.transform = "scale(0.5)"; }
    swipeState.current = null;
  }, [messages]);

  const handleReply = (msg: { id: string; text: string; displayName: string; imageUrl?: string }) => {
    setReplyTo({ id: msg.id, text: msg.text, displayName: msg.displayName, imageUrl: msg.imageUrl });
    inputRef.current?.focus();
    setActionSheet(null);
  };

  const handleEditStart = (msg: { id: string; text: string }) => {
    setEditingMsgId(msg.id);
    setEditText(msg.text);
    setActionSheet(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMsgId || !editText.trim()) return;
    await editMessage(editingMsgId, editText.trim());
    setEditingMsgId(null);
    setEditText("");
  };

  const handleDeleteMsg = (msgId: string) => {
    setDeleteMsgConfirm(msgId);
  };

  const handleDeleteMsgConfirmed = async () => {
    if (!deleteMsgConfirm) return;
    await deleteMessage(deleteMsgConfirm);
    setDeleteMsgConfirm(null);
    setActionSheet(null);
  };

  const handlePin = async (msgId: string) => {
    if (!roomId) return;
    if (room?.pinnedMessageId === msgId) {
      await unpinMessage(roomId);
    } else {
      await pinMessage(roomId, msgId);
    }
    setActionSheet(null);
  };

  const handleBookmark = async (msgId: string, msgText: string) => {
    if (!user) return;
    const key = `${roomId}:${msgId}`;
    const userRef = doc(db, "users", user.uid);
    if (bookmarks.has(key)) {
      await updateDoc(userRef, { [`bookmarks.${msgId}`]: null });
      setBookmarks((prev) => { const n = new Set(prev); n.delete(key); return n; });
    } else {
      await updateDoc(userRef, { [`bookmarks.${msgId}`]: { roomId, msgId, text: msgText.slice(0, 120), ts: Date.now() } });
      setBookmarks((prev) => new Set(prev).add(key));
    }
    setActionSheet(null);
  };

  const formatTime = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    return ts.toDate().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  };

  const formatDateLabel = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    const d = ts.toDate();
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return t.today;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t.yesterday;
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const renderText = (text: string, msgId: string) => {
    if (!text) return null;
    const userFirstName = user?.displayName?.split(" ")[0] ?? "";
    const parts = text.split(/(\s+|(?=@))/);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (searchQuery.trim() && part.toLowerCase().includes(searchQuery.toLowerCase())) {
        const searchParts = part.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
        return (
          <span key={`${msgId}-p${idx}`}>
            {searchParts.map((sp, si) =>
              sp.toLowerCase() === searchQuery.toLowerCase()
                ? <mark key={si} className="bg-green-600/40 text-green-200 rounded px-0.5">{sp}</mark>
                : sp
            )}
          </span>
        );
      }
      if (part.startsWith("@")) {
        const mention = part.slice(1).toLowerCase();
        const isSelf = mention === userFirstName.toLowerCase() || mention === user?.displayName?.toLowerCase();
        return (
          <span
            key={`${msgId}-m${idx}`}
            className={`font-semibold px-0.5 rounded ${isSelf ? "bg-green-500/20 text-green-300" : "text-green-500"}`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const safeTop = "env(safe-area-inset-top, 44px)";
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  if (!roomId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-center px-6">
        <div className="w-24 h-24 rounded-3xl bg-green-900/15 border border-green-900/30 flex items-center justify-center mb-5 shadow-[0_0_60px_rgba(0,200,0,0.05)]">
          <span className="text-green-500 text-4xl font-bold font-mono">TC</span>
        </div>
        <h2 className="text-green-300 font-bold text-xl mb-2 font-mono">TermChat</h2>
        <p className="text-green-800 text-sm max-w-xs leading-relaxed">{t.selectRoom}</p>
        <div className="flex items-center gap-2 mt-6 text-green-900 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green-900"></span>
          <span>{t.endToEnd}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-900"></span>
        </div>
      </div>
    );
  }

  let lastDateLabel = "";
  const ownMessages = messages.filter((m) => m.uid === user?.uid);
  const lastOwnMsg = ownMessages[ownMessages.length - 1];
  const isLastOwnRead = lastOwnMsg?.readBy
    ? lastOwnMsg.readBy.some((uid) => uid !== user?.uid)
    : false;

  const activeAction = actionSheet ? messages.find((m) => m.id === actionSheet.msgId) : null;

  return (
    <>
      <div className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden" dir={lang === "ar" ? "rtl" : "ltr"}>
        {/* Header */}
        <div
          className="bg-[#0f0f0f] border-b border-white/5 flex items-center gap-3 px-3 pb-3 shrink-0"
          style={{ paddingTop: `calc(${safeTop} + 8px)` }}
        >
          {showBack && (
            <button
              onClick={onBack}
              className="flex p-2 -ml-1 text-green-600 hover:text-green-400 active:scale-95 transition-all shrink-0 items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <button
            onClick={() => room?.type === "dm" && otherUser ? setProfileUid(otherUser.uid) : setProfileUid(user!.uid)}
            className="relative shrink-0 active:opacity-70 transition-opacity"
          >
            {room?.type === "dm" && otherUser ? (
              <>
                <Avatar name={otherUser.displayName} photoURL={otherUser.photoURL} size="sm" />
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f0f0f] ${otherUser.status === "online" ? "bg-green-500" : "bg-gray-700"}`} />
              </>
            ) : (
              <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center">
                <span className="text-green-500 font-bold text-sm font-mono">#</span>
              </div>
            )}
          </button>

          <button
            onClick={() => room?.type === "dm" && otherUser ? setProfileUid(otherUser.uid) : undefined}
            className={`flex-1 min-w-0 text-left ${room?.type === "dm" ? "active:opacity-70" : ""}`}
          >
            <div className="text-green-300 font-semibold text-sm truncate">
              {room?.type === "group" ? `# ${roomTitle}` : roomTitle}
            </div>
            {otherUser ? (
              <div className={`text-xs ${otherUser.status === "online" ? "text-green-600" : "text-green-900"}`}>
                {otherUser.statusText ? otherUser.statusText : otherUser.status === "online" ? t.online2 : t.offline}
              </div>
            ) : room?.type === "group" ? (
              <div className="text-green-900 text-xs">{room.members.length} {t.members}</div>
            ) : null}
          </button>

          {/* Per-room search */}
          <button
            onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(""); }}
            className={`p-2 transition-all active:scale-95 shrink-0 ${searchOpen ? "text-green-400" : "text-green-800 hover:text-green-500"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Members button for group */}
          {room?.type === "group" && (
            <button
              onClick={() => setShowMembersModal(true)}
              className="p-2 text-green-800 hover:text-green-500 active:scale-95 transition-all shrink-0"
              title={t.membersTitle}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {/* More options (...) */}
          {(isGroupAdmin || room?.type === "dm") && (
            <div className="relative shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
                className="p-2 text-green-800 hover:text-green-500 active:scale-95 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMoreMenu && (
                <div
                  className="absolute end-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-30 min-w-[160px] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {room?.type === "dm" && (
                    <button
                      onClick={async () => {
                        if (room.archived) await unarchiveRoom(room.id);
                        else await archiveRoom(room.id);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-green-700 text-sm hover:bg-white/5 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      {room.archived ? t.unarchiveChannel : t.archiveChannel}
                    </button>
                  )}
                  {isGroupAdmin && room.name !== "general" && (
                    <>
                      <button
                        onClick={() => { setShowMembersModal(true); setShowMoreMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-green-300 text-sm hover:bg-white/5 transition-colors text-left"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {t.editChannel}
                      </button>
                      <button
                        onClick={async () => {
                          if (room.archived) await unarchiveRoom(room.id);
                          else await archiveRoom(room.id);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-green-700 text-sm hover:bg-white/5 transition-colors text-left"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        {room.archived ? t.unarchiveChannel : t.archiveChannel}
                      </button>
                      <div className="h-px bg-white/5 mx-2" />
                      <button
                        onClick={() => { setShowDeleteConfirm(true); setShowMoreMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-red-500 text-sm hover:bg-white/5 transition-colors text-left"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t.deleteRoom}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="bg-[#0f0f0f] border-b border-white/5 px-3 py-2 flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4 text-green-800 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-800 text-sm"
            />
            {searchQuery && (
              <span className="text-green-900 text-xs shrink-0">{filteredMessages.length} {filteredMessages.length !== 1 ? t.searchResultsPlural : t.searchResults}</span>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-green-800 hover:text-green-500 transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Pinned message banner */}
        {pinnedMsg && !pinnedMsg.deletedAt && (
          <div className="bg-[#0f0f0f] border-b border-green-900/30 px-4 py-2 flex items-center gap-3 shrink-0">
            <svg className="w-3.5 h-3.5 text-green-700 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-green-900 text-[10px]">{t.pinnedMsg}</p>
              <p className="text-green-700 text-xs truncate">{pinnedMsg.text || "📷 Photo"}</p>
            </div>
            {isGroupAdmin && (
              <button
                onClick={() => roomId && unpinMessage(roomId)}
                className="text-green-900 hover:text-green-600 transition-colors shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {filteredMessages.length === 0 && !searchQuery && (
            <div className="flex flex-col items-center justify-center h-full text-green-900 text-sm py-10">
              <p>{t.noMessages}</p>
              <p className="text-xs mt-1">{t.sendFirst}</p>
            </div>
          )}
          {filteredMessages.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center h-full text-green-900 text-sm py-10">
              <p>{t.noResults} "{searchQuery}"</p>
            </div>
          )}

          {filteredMessages.map((msg, i) => {
            const isDeleted = !!msg.deletedAt;
            const isOwn = msg.uid === user?.uid;
            const prev = filteredMessages[i - 1];
            const next = filteredMessages[i + 1];
            const isGroupStart = !prev || prev.uid !== msg.uid ||
              (msg.createdAt && prev.createdAt &&
                msg.createdAt.toDate().getTime() - prev.createdAt.toDate().getTime() > 120000);
            const isGroupEnd = !next || next.uid !== msg.uid ||
              (msg.createdAt && next.createdAt &&
                next.createdAt.toDate().getTime() - msg.createdAt.toDate().getTime() > 120000);
            const isLastOwnInChat = msg.id === lastOwnMsg?.id;

            const dateLabel = formatDateLabel(msg.createdAt);
            const showDate = dateLabel !== lastDateLabel;
            if (showDate) lastDateLabel = dateLabel;

            const hasReactions = !isDeleted && msg.reactions && Object.values(msg.reactions).some((arr) => arr.length > 0);
            const isEditing = editingMsgId === msg.id;
            const isPinned = room?.pinnedMessageId === msg.id;
            const isBookmarked = bookmarks.has(`${roomId}:${msg.id}`);

            const msgUrls = !isDeleted && msg.text ? detectUrls(msg.text) : [];

            if (msg.type === "system") {
              return (
                <div key={msg.id} className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-green-900 text-xs px-2">{msg.text}</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
              );
            }

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-green-900 text-xs">{dateLabel}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}

                <div
                  className={`flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-3" : "mt-0.5"} relative select-none`}
                  onPointerDown={() => !isDeleted && handleLongPressStart(msg.id, isOwn)}
                  onPointerUp={handleLongPressEnd}
                  onPointerLeave={handleLongPressEnd}
                  onTouchStart={(e) => handleSwipeStart(e, msg.id, isOwn)}
                  onTouchMove={handleSwipeMove}
                  onTouchEnd={handleSwipeEnd}
                  onTouchCancel={handleSwipeEnd}
                  onContextMenu={(e) => { e.preventDefault(); if (!isDeleted) setActionSheet({ msgId: msg.id, isOwn }); }}
                >
                  {/* Swipe-to-reply icon */}
                  <div
                    data-swipe-icon
                    className={`absolute ${isOwn ? "left-1" : "right-1"} top-1/2 -translate-y-1/2 text-green-500 pointer-events-none z-10`}
                    style={{ opacity: 0, transform: "scale(0.5)" }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </div>

                  {/* Avatar in group */}
                  {!isOwn && room?.type === "group" && (
                    <div className="w-7 shrink-0 self-end mb-1">
                      {isGroupEnd ? (
                        <button onClick={() => setProfileUid(msg.uid)} className="active:opacity-70">
                          <Avatar name={msg.displayName} photoURL={msg.photoURL} size="sm" />
                        </button>
                      ) : null}
                    </div>
                  )}

                  <div data-bubble className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[78%] relative`}>
                    {isGroupStart && !isOwn && room?.type === "group" && (
                      <button onClick={() => setProfileUid(msg.uid)} className="text-green-700 text-xs font-semibold mb-1 ml-1 active:opacity-70">
                        {msg.displayName}
                      </button>
                    )}

                    {/* Reply preview */}
                    {msg.replyTo && !isDeleted && (
                      <div className={`mb-1 px-2.5 py-1.5 rounded-xl border-l-2 border-green-600 bg-green-900/20 max-w-full`}>
                        <div className="text-green-600 text-[10px] font-semibold truncate">{msg.replyTo.displayName}</div>
                        <div className="text-green-800 text-xs truncate">
                          {msg.replyTo.imageUrl ? "📷 Photo" : msg.replyTo.text}
                        </div>
                      </div>
                    )}

                    {/* Pinned indicator */}
                    {isPinned && (
                      <div className={`flex items-center gap-1 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                        <svg className="w-3 h-3 text-green-700" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                        </svg>
                        <span className="text-green-900 text-[10px]">{t.pinnedMsg}</span>
                      </div>
                    )}

                    {/* Deleted message */}
                    {isDeleted ? (
                      <div className={`px-3.5 py-2.5 text-sm rounded-2xl italic ${
                        isOwn ? "bg-white/4 text-green-900" : "bg-white/4 text-green-900"
                      }`}>
                        🚫 {lang === "ar" ? "تم حذف هذه الرسالة" : lang === "fr" ? "Message supprimé" : "This message was deleted"}
                      </div>
                    ) : (
                      <>
                        {/* Image */}
                        {msg.imageUrl && (
                          <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
                            <img
                              src={msg.imageUrl}
                              alt="Sent image"
                              className={`max-w-[65vw] sm:max-w-[240px] max-h-[260px] object-cover rounded-2xl border border-white/8 ${isOwn ? "rounded-br-sm" : "rounded-bl-sm"}`}
                              loading="lazy"
                            />
                          </a>
                        )}

                        {/* Inline edit */}
                        {isEditing ? (
                          <form onSubmit={handleEditSubmit} className="flex items-center gap-2 w-full">
                            <input
                              ref={editInputRef}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="flex-1 bg-green-900/20 border border-green-700/50 rounded-xl px-3 py-2 text-sm text-green-200 outline-none min-w-0"
                            />
                            <button type="submit" className="text-green-500 hover:text-green-400 p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button type="button" onClick={() => setEditingMsgId(null)} className="text-green-900 hover:text-green-600 p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </form>
                        ) : (
                          /* Text */
                          msg.text && (
                            <div className={`px-3.5 py-2.5 text-sm leading-relaxed break-words rounded-2xl ${
                              isOwn
                                ? "bg-green-800/50 text-green-100 rounded-br-sm"
                                : "bg-[#1c1c1c] text-green-200 border border-white/5 rounded-bl-sm"
                            }`}>
                              {renderText(msg.text, msg.id)}
                              {msg.edited && (
                                <span className="text-green-900 text-[10px] ml-1.5">({t.edited})</span>
                              )}
                            </div>
                          )
                        )}

                        {/* Link preview */}
                        {!isEditing && msgUrls.length > 0 && (
                          <LinkPreview url={msgUrls[0]} />
                        )}
                      </>
                    )}

                    {/* Reactions */}
                    {hasReactions && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(msg.reactions ?? {}).map(([emoji, uids]) =>
                          uids.length > 0 ? (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all active:scale-95 ${
                                uids.includes(user?.uid ?? "")
                                  ? "bg-green-800/40 border-green-700/60 text-green-300"
                                  : "bg-white/5 border-white/10 text-green-700"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-semibold">{uids.length}</span>
                            </button>
                          ) : null
                        )}
                      </div>
                    )}

                    {/* Time + controls */}
                    {isGroupEnd && !isEditing && (
                      <div className={`flex items-center gap-2 mt-1 mx-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                        <span className="text-green-900 text-[10px]">{formatTime(msg.createdAt)}</span>
                        {isOwn && room?.type === "dm" && isLastOwnInChat && (
                          <span className={`text-[10px] font-bold ${isLastOwnRead ? "text-green-500" : "text-green-900"}`}>
                            {isLastOwnRead ? "✓✓" : "✓"}
                          </span>
                        )}
                        {/* Bookmark indicator */}
                        {isBookmarked && (
                          <span className="text-green-700 text-[10px]">🔖</span>
                        )}
                        {!isDeleted && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                            className="text-green-900 hover:text-green-600 transition-colors active:scale-95"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Action sheet (long-press menu) */}
                    {actionSheet?.msgId === msg.id && activeAction && (
                      <div
                        data-action-sheet
                        className={`absolute ${isOwn ? "right-0" : "left-0"} -top-[calc(100%+8px)] z-40 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]`}
                        style={{ bottom: "auto" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Quick reactions */}
                        <div className="flex items-center gap-1 px-2 py-2 border-b border-white/5">
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => { toggleReaction(msg.id, emoji); setActionSheet(null); }}
                              className={`w-9 h-9 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 rounded-full ${
                                activeAction.reactions?.[emoji]?.includes(user?.uid ?? "") ? "bg-green-800/40" : ""
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {/* Action buttons */}
                        <div className="py-1">
                          <button
                            onClick={() => handleReply(msg)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-green-300 text-sm hover:bg-white/5 transition-colors text-left"
                          >
                            <svg className="w-4 h-4 shrink-0 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            {t.replyMsg}
                          </button>

                          {isOwn && !isDeleted && (
                            <button
                              onClick={() => handleEditStart(msg)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-green-300 text-sm hover:bg-white/5 transition-colors text-left"
                            >
                              <svg className="w-4 h-4 shrink-0 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              {t.editMsg}
                            </button>
                          )}

                          {room?.type === "group" && isGroupAdmin && !isDeleted && (
                            <button
                              onClick={() => handlePin(msg.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-green-300 text-sm hover:bg-white/5 transition-colors text-left"
                            >
                              <svg className="w-4 h-4 shrink-0 text-green-700" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                              </svg>
                              {room.pinnedMessageId === msg.id ? t.unpinMsg : t.pinMsg}
                            </button>
                          )}

                          {!isDeleted && (
                            <button
                              onClick={() => handleBookmark(msg.id, msg.text)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-green-300 text-sm hover:bg-white/5 transition-colors text-left"
                            >
                              <span className="text-green-700 text-base leading-none shrink-0">🔖</span>
                              {isBookmarked ? (lang === "ar" ? "إزالة الإشارة" : lang === "fr" ? "Retirer le signet" : "Remove bookmark") : (lang === "ar" ? "وضع إشارة" : lang === "fr" ? "Ajouter un signet" : "Bookmark")}
                            </button>
                          )}

                          {isOwn && !isDeleted && (
                            deleteMsgConfirm === msg.id ? (
                              <div className="px-4 py-3 border-t border-white/5">
                                <p className="text-green-700 text-xs mb-2">
                                  {lang === "ar" ? "تأكيد حذف الرسالة؟" : lang === "fr" ? "Supprimer ce message ?" : "Delete this message?"}
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleDeleteMsgConfirmed}
                                    className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-colors"
                                  >
                                    {lang === "ar" ? "حذف" : lang === "fr" ? "Supprimer" : "Delete"}
                                  </button>
                                  <button
                                    onClick={() => setDeleteMsgConfirm(null)}
                                    className="flex-1 py-1.5 rounded-lg bg-white/5 text-green-700 text-xs hover:bg-white/10 transition-colors"
                                  >
                                    {lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleDeleteMsg(msg.id)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 text-sm hover:bg-white/5 transition-colors text-left"
                              >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {t.deleteMsg}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 mt-3 ml-1">
              <div className="flex items-center gap-1 bg-[#1c1c1c] border border-white/5 rounded-2xl rounded-bl-sm px-3 py-2">
                <span className="text-green-700 text-xs mr-1">
                  {typingUsers.length === 1 ? typingUsers[0] : `${typingUsers.length} ${t.people}`} {t.typing}
                </span>
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Image preview */}
        {previewImage && (
          <div className="px-4 py-2 bg-[#0f0f0f] border-t border-white/5 flex items-center gap-3 shrink-0">
            <div className="relative">
              <img src={previewImage} alt="Preview" className="h-14 w-14 object-cover rounded-xl border border-white/10" />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-900 text-white flex items-center justify-center text-xs font-bold"
              >
                ×
              </button>
            </div>
            <span className="text-green-900 text-xs">{t.imageReady}</span>
          </div>
        )}

        {/* Reply preview bar */}
        {replyTo && (
          <div className="px-4 py-2 bg-[#0f0f0f] border-t border-white/5 flex items-center gap-3 shrink-0">
            <div className="w-0.5 h-8 bg-green-600 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-green-600 text-[10px] font-semibold">{replyTo.displayName}</div>
              <div className="text-green-800 text-xs truncate">
                {replyTo.imageUrl ? "📷 Photo" : replyTo.text}
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-green-900 hover:text-green-600 transition-colors shrink-0 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Input bar */}
        <div
          className="bg-[#0f0f0f] border-t border-white/5 px-3 pt-2 shrink-0"
          style={{ paddingBottom: `calc(${safeBottom} + 8px)` }}
        >
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileUid(user!.uid)}
              className="shrink-0 active:opacity-70 transition-opacity"
            >
              <Avatar name={user?.displayName} photoURL={user?.photoURL} size="sm" />
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingImage}
              className="w-9 h-9 rounded-full flex items-center justify-center text-green-800 hover:text-green-500 bg-white/5 transition-all active:scale-95 disabled:opacity-40 shrink-0"
            >
              {uploadingImage ? (
                <span className="w-4 h-4 border-2 border-green-900 border-t-green-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

            <div className="flex-1 flex items-center bg-white/5 border border-white/8 rounded-full px-4 py-2.5 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                disabled={sending}
                placeholder={replyTo ? `${t.replyPlaceholder} ${replyTo.displayName}...` : previewImage ? t.captionPlaceholder : t.messagePlaceholder}
                className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900 text-[15px] min-w-0"
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="send"
                inputMode="text"
              />
            </div>

            <button
              type="submit"
              disabled={(!input.trim() && !previewImage) || sending || uploadingImage}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                (input.trim() || previewImage) && !sending && !uploadingImage
                  ? "bg-green-600 text-black"
                  : "bg-white/5 text-green-900"
              }`}
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-green-900 border-t-green-400 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Delete room confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-[#111] border border-white/8 rounded-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-green-300 font-bold text-base mb-2">{t.deleteRoomTitle} # {room?.name}?</h3>
            <p className="text-green-800 text-sm mb-5">{t.deleteRoomConfirm}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 border border-white/8 text-green-800 rounded-xl text-sm">
                {t.cancelDelete}
              </button>
              <button
                onClick={handleDeleteRoom}
                disabled={deleting}
                className="flex-1 py-3 bg-red-900 hover:bg-red-800 text-red-200 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? t.deleting : t.deleteRoom}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileUid && (
        <ProfileModal
          uid={profileUid}
          onClose={() => setProfileUid(null)}
          onSendMessage={async (uid) => {
            const rid = await openDM(uid);
            if (rid) setProfileUid(null);
          }}
        />
      )}

      {showMembersModal && room && (
        <MembersModal room={room} onClose={() => setShowMembersModal(false)} />
      )}
    </>
  );
}
