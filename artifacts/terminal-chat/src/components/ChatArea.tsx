import { useState, useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { useRooms, Room } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { uploadImageToImgbb } from "@/lib/imgbb";
import Avatar from "./Avatar";
import ProfileModal from "./ProfileModal";

interface ChatAreaProps {
  roomId: string | null;
  onBack: () => void;
  onRoomDeleted: () => void;
}

export default function ChatArea({ roomId, onBack, onRoomDeleted }: ChatAreaProps) {
  const { user } = useAuth();
  const { rooms, openDM, deleteRoom } = useRooms();
  const users = useUsers();
  const { messages, sendMessage } = useMessages(roomId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const room: Room | undefined = rooms.find((r) => r.id === roomId);
  const isGroupCreator = room?.type === "group" && room.createdBy === user?.uid;

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !previewImage) || sending) return;
    const text = input;
    const imgUrl = previewImage;
    setInput("");
    setPreviewImage(null);
    setSending(true);
    await sendMessage(text, imgUrl ?? undefined);
    setSending(false);
    inputRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
      alert("Failed to upload image. Please try again.");
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

  const handleOpenProfile = (uid: string) => setProfileUid(uid);

  const handleSendMessageFromProfile = async (uid: string) => {
    const roomId = await openDM(uid);
    if (roomId) {
      setProfileUid(null);
    }
  };

  const formatTime = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    return ts.toDate().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  };

  const formatDateLabel = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "";
    const d = ts.toDate();
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const safeTop = "env(safe-area-inset-top, 44px)";
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  if (!roomId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-center px-6">
        <div className="w-20 h-20 rounded-full bg-green-900/20 border border-green-900/50 flex items-center justify-center mb-4">
          <span className="text-green-600 text-3xl font-bold font-mono">TC</span>
        </div>
        <h2 className="text-green-400 font-bold text-lg mb-2">TermChat</h2>
        <p className="text-green-800 text-sm">Select a conversation to start messaging</p>
      </div>
    );
  }

  let lastDateLabel = "";

  return (
    <>
      <div className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden">
        {/* Header — uses safe-area-inset-top */}
        <div
          className="bg-[#0f0f0f] border-b border-white/5 flex items-center gap-3 px-3 pb-3 shrink-0"
          style={{ paddingTop: `calc(${safeTop} + 8px)` }}
        >
          <button
            onClick={onBack}
            className="lg:hidden p-2 -ml-1 text-green-600 hover:text-green-400 active:scale-95 transition-all shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Avatar — click to view profile */}
          <button
            onClick={() => handleOpenProfile(room?.type === "dm" && otherUser ? otherUser.uid : user!.uid)}
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

          {/* Title — click to view profile (DM) */}
          <button
            onClick={() => room?.type === "dm" && otherUser ? handleOpenProfile(otherUser.uid) : undefined}
            className={`flex-1 min-w-0 text-left ${room?.type === "dm" ? "active:opacity-70" : ""}`}
          >
            <div className="text-green-300 font-semibold text-sm truncate">
              {room?.type === "group" ? `# ${roomTitle}` : roomTitle}
            </div>
            {otherUser ? (
              <div className={`text-xs ${otherUser.status === "online" ? "text-green-600" : "text-green-900"}`}>
                {otherUser.status === "online" ? "Online" : "Offline"}
              </div>
            ) : room?.type === "group" ? (
              <div className="text-green-900 text-xs">{room.members.length} members</div>
            ) : null}
          </button>

          {/* Delete button — only for group creators */}
          {isGroupCreator && room.name !== "general" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-900 hover:text-red-500 active:scale-95 transition-all shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-green-900 text-sm py-10">
              <p>No messages yet</p>
              <p className="text-xs mt-1">Send the first message!</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isOwn = msg.uid === user?.uid;
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const isGroupStart = !prev || prev.uid !== msg.uid ||
              (msg.createdAt && prev.createdAt &&
                msg.createdAt.toDate().getTime() - prev.createdAt.toDate().getTime() > 120000);
            const isGroupEnd = !next || next.uid !== msg.uid ||
              (msg.createdAt && next.createdAt &&
                next.createdAt.toDate().getTime() - msg.createdAt.toDate().getTime() > 120000);

            const dateLabel = formatDateLabel(msg.createdAt);
            const showDate = dateLabel !== lastDateLabel;
            if (showDate) lastDateLabel = dateLabel;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-green-900 text-xs">{dateLabel}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}

                <div className={`flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : "flex-row"} ${isGroupStart ? "mt-3" : "mt-0.5"}`}>
                  {/* Other user avatar in group */}
                  {!isOwn && room?.type === "group" && (
                    <div className="w-7 shrink-0 self-end mb-1">
                      {isGroupEnd ? (
                        <button onClick={() => handleOpenProfile(msg.uid)} className="active:opacity-70">
                          <Avatar name={msg.displayName} photoURL={msg.photoURL} size="sm" />
                        </button>
                      ) : null}
                    </div>
                  )}

                  <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[78%]`}>
                    {isGroupStart && !isOwn && room?.type === "group" && (
                      <button
                        onClick={() => handleOpenProfile(msg.uid)}
                        className="text-green-700 text-xs font-semibold mb-1 ml-1 active:opacity-70"
                      >
                        {msg.displayName}
                      </button>
                    )}

                    {/* Image */}
                    {msg.imageUrl && (
                      <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
                        <img
                          src={msg.imageUrl}
                          alt="Sent image"
                          className={`max-w-[240px] max-h-[280px] object-cover rounded-2xl border border-white/8 ${isOwn ? "rounded-br-sm" : "rounded-bl-sm"}`}
                          loading="lazy"
                        />
                      </a>
                    )}

                    {/* Text */}
                    {msg.text && (
                      <div className={`px-3.5 py-2.5 text-sm leading-relaxed break-words rounded-2xl ${
                        isOwn
                          ? "bg-green-800/50 text-green-100 rounded-br-sm"
                          : "bg-[#1c1c1c] text-green-200 border border-white/5 rounded-bl-sm"
                      }`}>
                        {msg.text}
                      </div>
                    )}

                    {isGroupEnd && (
                      <span className="text-green-900 text-[10px] mt-1 mx-1">{formatTime(msg.createdAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
            <span className="text-green-900 text-xs">Image ready · add a caption below</span>
          </div>
        )}

        {/* Input bar — safe area bottom padding */}
        <div
          className="bg-[#0f0f0f] border-t border-white/5 px-3 pt-2 shrink-0"
          style={{ paddingBottom: `calc(${safeBottom} + 8px)` }}
        >
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenProfile(user!.uid)}
              className="shrink-0 active:opacity-70 transition-opacity"
            >
              <Avatar name={user?.displayName} photoURL={user?.photoURL} size="sm" />
            </button>

            {/* Image button */}
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

            {/* Text input */}
            <div className="flex-1 flex items-center bg-white/5 border border-white/8 rounded-full px-4 py-2.5 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
                placeholder={previewImage ? "Add caption..." : "Message..."}
                className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900 text-[15px] min-w-0"
                autoComplete="off"
                autoCapitalize="sentences"
              />
            </div>

            {/* Send */}
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

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-[#111] border border-white/8 rounded-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-green-300 font-bold text-base mb-2">Delete # {room?.name}?</h3>
            <p className="text-green-800 text-sm mb-5">All messages will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 border border-white/8 text-green-800 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRoom}
                disabled={deleting}
                className="flex-1 py-3 bg-red-900 hover:bg-red-800 text-red-200 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {profileUid && (
        <ProfileModal
          uid={profileUid}
          onClose={() => setProfileUid(null)}
          onSendMessage={handleSendMessageFromProfile}
        />
      )}
    </>
  );
}
