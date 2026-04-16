import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { uploadImageToImgbb } from "@/lib/imgbb";
import Avatar from "./Avatar";

interface ProfileModalProps {
  uid: string;
  onClose: () => void;
  onSendMessage?: (uid: string) => void;
}

export default function ProfileModal({ uid, onClose, onSendMessage }: ProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const users = useUsers();
  const profile = users.find((u) => u.uid === uid);
  const isOwn = user?.uid === uid;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayPhoto = localPhoto ?? profile?.photoURL ?? null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateProfile(name.trim(), displayPhoto, bio.trim());
    setSaving(false);
    setEditing(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingPhoto(true);
    try {
      const url = await uploadImageToImgbb(file);
      setLocalPhoto(url);
    } catch {
      alert("Failed to upload photo. Try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const formatDate = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "Unknown";
    return ts.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-[#111] border border-white/8 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="w-10 h-1 bg-white/15 rounded-full" />
        </div>

        {/* Header gradient area */}
        <div className="bg-gradient-to-b from-green-950/30 to-transparent px-5 pt-6 pb-4 flex flex-col items-center">
          {/* Avatar */}
          <div className="relative mb-3">
            {editing ? (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="relative block"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-700">
                  {displayPhoto ? (
                    <img src={displayPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-green-900/50 flex items-center justify-center text-green-400 text-2xl font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  {uploadingPhoto ? (
                    <span className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </button>
            ) : (
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-900/60">
                <Avatar name={profile?.displayName} photoURL={displayPhoto} size="lg" />
              </div>
            )}
            {/* Status dot */}
            {!editing && (
              <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#111] ${profile?.status === "online" ? "bg-green-500" : "bg-gray-600"}`} />
            )}
          </div>

          {/* Name */}
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-green-300 font-semibold text-center text-base outline-none focus:border-green-700 w-full"
              autoFocus
            />
          ) : (
            <h2 className="text-green-200 font-bold text-xl text-center">{profile?.displayName}</h2>
          )}

          {/* Status */}
          {!editing && (
            <p className={`text-xs mt-1 ${profile?.status === "online" ? "text-green-500" : "text-green-900"}`}>
              {profile?.status === "online" ? "● Online" : "● Offline"}
            </p>
          )}
        </div>

        {/* Info section */}
        <div className="px-5 pb-2 space-y-3">
          {/* Bio */}
          <div>
            <label className="text-green-900 text-xs uppercase tracking-wider">About</label>
            {editing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={120}
                rows={2}
                placeholder="Write something about yourself..."
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-green-300 text-sm outline-none focus:border-green-700 resize-none placeholder-green-900"
              />
            ) : (
              <p className="text-green-700 text-sm mt-1 min-h-[1.5rem]">
                {profile?.bio || (isOwn ? "No bio yet. Tap edit to add one." : "No bio.")}
              </p>
            )}
          </div>

          {/* Email (own only) */}
          {isOwn && !editing && (
            <div>
              <label className="text-green-900 text-xs uppercase tracking-wider">Email</label>
              <p className="text-green-700 text-sm mt-1">{user?.email}</p>
            </div>
          )}

          {/* Member since */}
          {!editing && (
            <div>
              <label className="text-green-900 text-xs uppercase tracking-wider">Member since</label>
              <p className="text-green-700 text-sm mt-1">{formatDate(profile?.joinedAt ?? null)}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 space-y-2">
          {isOwn ? (
            editing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setLocalPhoto(null); setName(profile?.displayName ?? ""); setBio(profile?.bio ?? ""); }}
                  className="flex-1 py-3 border border-white/8 text-green-800 rounded-xl text-sm transition-colors hover:text-green-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-black font-semibold rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 bg-white/5 hover:bg-white/8 border border-white/8 text-green-400 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              >
                Edit Profile
              </button>
            )
          ) : (
            <button
              onClick={() => { onClose(); onSendMessage?.(uid); }}
              className="w-full py-3 bg-green-700 hover:bg-green-600 text-black font-semibold rounded-xl text-sm transition-all active:scale-[0.98]"
            >
              Send Message
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 text-green-900 text-sm transition-colors hover:text-green-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
