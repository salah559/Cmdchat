import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useLang } from "@/contexts/LanguageContext";
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
  const { t, lang } = useLang();
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
  const isSpecialUser = profile?.displayName === "bouazza SALAH";
  const specialBanner = "/ceo-banner.jpg";

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
      alert(t.failedUploadPhoto);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const formatDate = (ts: { toDate: () => Date } | null) => {
    if (!ts) return t.unknown;
    const locale = lang === "ar" ? "ar-SA" : lang === "fr" ? "fr-FR" : "en-US";
    return ts.toDate().toLocaleDateString(locale, { year: "numeric", month: "long" });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-[#111] border border-white/8 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {/* Banner */}
        <div className="h-32 overflow-hidden relative">
          {isSpecialUser ? (
            <>
              <img
                src={specialBanner}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#111]" />
            </>
          ) : displayPhoto ? (
            <>
              <img
                src={displayPhoto}
                alt=""
                className="w-full h-full object-cover scale-110"
                style={{ filter: "blur(18px) brightness(0.4) saturate(0.6)" }}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-[#111]" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-green-950/50 to-[#111]" />
          )}
          {/* Pull handle */}
          <div className="absolute top-2.5 left-0 right-0 flex justify-center sm:hidden">
            <div className="w-10 h-1 bg-white/25 rounded-full" />
          </div>
        </div>

        {/* Avatar — pulled up with negative margin to overlap banner */}
        <div className="flex justify-center -mt-12 px-5">
          {editing ? (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              className="relative block"
            >
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-xl" style={{ border: "3px solid #111" }}>
                {displayPhoto ? (
                  <img src={displayPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-green-900/50 flex items-center justify-center text-green-400 text-3xl font-bold">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
                {uploadingPhoto ? (
                  <span className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-7 h-7 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </button>
          ) : (
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-xl" style={{ border: "3px solid #111" }}>
                {displayPhoto ? (
                  <img src={displayPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-green-900/50 flex items-center justify-center text-green-400 text-3xl font-bold font-mono">
                    {(profile?.displayName ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className={`absolute -bottom-1 -end-1 w-4 h-4 rounded-full border-2 border-[#111] ${profile?.status === "online" ? "bg-green-500" : "bg-gray-600"}`} />
            </div>
          )}
        </div>

        {/* Name + status */}
        <div className="pt-3 pb-2 px-5 flex flex-col items-center text-center">
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
            <h2 className="text-green-200 font-bold text-xl">{profile?.displayName}</h2>
          )}
          {!editing && (
            <p className={`text-xs mt-1 ${profile?.status === "online" ? "text-green-500" : "text-green-900"}`}>
              {profile?.status === "online" ? `● ${t.online2}` : `● ${t.offline}`}
            </p>
          )}
        </div>

        <div className="px-5 pb-2 space-y-3">
          <div>
            <label className="text-green-900 text-xs uppercase tracking-wider">{t.bio}</label>
            {editing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={120}
                rows={2}
                placeholder={t.bioPlaceholder}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-green-300 text-sm outline-none focus:border-green-700 resize-none placeholder-green-900"
              />
            ) : (
              <p className="text-green-700 text-sm mt-1 min-h-[1.5rem]">
                {profile?.bio || (isOwn ? t.noBioOwn : t.noBio)}
              </p>
            )}
          </div>

          {isOwn && !editing && (
            <div>
              <label className="text-green-900 text-xs uppercase tracking-wider">{t.email}</label>
              <p className="text-green-700 text-sm mt-1">{user?.email}</p>
            </div>
          )}

          {!editing && (
            <div>
              <label className="text-green-900 text-xs uppercase tracking-wider">{t.memberSince}</label>
              <p className="text-green-700 text-sm mt-1">{formatDate(profile?.joinedAt ?? null)}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-2">
          {isOwn ? (
            editing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setLocalPhoto(null); setName(profile?.displayName ?? ""); setBio(profile?.bio ?? ""); }}
                  className="flex-1 py-3 border border-white/8 text-green-800 rounded-xl text-sm transition-colors hover:text-green-600"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-black font-semibold rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {saving ? t.saving : t.saveProfile}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 bg-white/5 hover:bg-white/8 border border-white/8 text-green-400 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              >
                {t.editProfile}
              </button>
            )
          ) : (
            <button
              onClick={() => { onClose(); onSendMessage?.(uid); }}
              className="w-full py-3 bg-green-700 hover:bg-green-600 text-black font-semibold rounded-xl text-sm transition-all active:scale-[0.98]"
            >
              {t.sendMessage}
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 text-green-900 text-sm transition-colors hover:text-green-700"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
