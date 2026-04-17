import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useLang, Lang } from "@/contexts/LanguageContext";
import { uploadImageToImgbb } from "@/lib/imgbb";
import { isSoundEnabled, toggleSound } from "@/lib/sounds";
import Avatar from "./Avatar";

interface SettingsModalProps {
  onClose: () => void;
}

type Tab = "account" | "preferences";

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { user, updateProfile } = useAuth();
  const users = useUsers();
  const { t, lang, setLang } = useLang();
  const profile = users.find((u) => u.uid === user?.uid);

  const [tab, setTab] = useState<Tab>("account");

  const [name, setName] = useState(profile?.displayName ?? user?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const fileRef = useRef<HTMLInputElement>(null);

  const displayPhoto = localPhoto ?? profile?.photoURL ?? user?.photoURL ?? null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateProfile(name.trim(), displayPhoto, bio.trim());
    setSaving(false);
    setSaved(true);
    setLocalPhoto(null);
    setTimeout(() => setSaved(false), 2000);
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
      alert("Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSoundToggle = () => {
    const next = toggleSound();
    setSoundOn(next);
  };

  const handleLangChange = (l: Lang) => {
    setLang(l);
  };

  const formatDate = (ts: { toDate: () => Date } | null) => {
    if (!ts) return "—";
    return ts.toDate().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long" });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-[#111] border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-white/15 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b border-white/5">
          <h2 className="text-green-300 font-bold text-base">{t.settings}</h2>
          <button onClick={onClose} className="text-green-800 hover:text-green-500 transition-colors active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-1 shrink-0">
          {(["account", "preferences"] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === tabKey
                  ? "bg-green-900/40 text-green-300 border border-green-800/50"
                  : "text-green-800 hover:text-green-600"
              }`}
            >
              {tabKey === "account" ? t.account : t.preferences}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          {tab === "account" && (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-900/60">
                    {displayPhoto ? (
                      <img src={displayPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Avatar name={name} photoURL={null} size="lg" />
                    )}
                  </div>
                  {uploadingPhoto && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                      <span className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-1.5 text-green-600 hover:text-green-400 text-xs border border-green-900/50 hover:border-green-700 px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t.uploadPhoto}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              {/* Display Name */}
              <div>
                <label className="text-green-900 text-xs uppercase tracking-wider block mb-1.5">{t.displayName}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder={t.namePlaceholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-green-300 text-sm outline-none focus:border-green-700 placeholder-green-900 transition-colors"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="text-green-900 text-xs uppercase tracking-wider block mb-1.5">{t.bio}</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={120}
                  rows={3}
                  placeholder={t.bioPlaceholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-green-300 text-sm outline-none focus:border-green-700 resize-none placeholder-green-900 transition-colors"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="text-green-900 text-xs uppercase tracking-wider block mb-1.5">{t.email}</label>
                <div className="bg-white/3 border border-white/5 rounded-xl px-3.5 py-2.5 text-green-800 text-sm select-text">
                  {user?.email ?? "—"}
                </div>
              </div>

              {/* Member since */}
              <div>
                <label className="text-green-900 text-xs uppercase tracking-wider block mb-1.5">{t.memberSince}</label>
                <div className="bg-white/3 border border-white/5 rounded-xl px-3.5 py-2.5 text-green-800 text-sm">
                  {formatDate(profile?.joinedAt ?? null)}
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 ${
                  saved
                    ? "bg-green-700 text-black"
                    : "bg-green-700 hover:bg-green-600 text-black"
                }`}
              >
                {saving ? t.saving : saved ? `✓ ${t.profileUpdated}` : t.saveProfile}
              </button>
            </>
          )}

          {tab === "preferences" && (
            <>
              {/* Language */}
              <div>
                <label className="text-green-900 text-xs uppercase tracking-wider block mb-3">{t.chooseLanguage}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["ar", "en"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLangChange(l)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all active:scale-[0.98] ${
                        lang === l
                          ? "bg-green-900/40 border-green-700 text-green-300"
                          : "bg-white/5 border-white/8 text-green-800 hover:text-green-600 hover:border-green-900"
                      }`}
                    >
                      <span className="block text-base mb-0.5">{l === "ar" ? "🇸🇦" : "🇬🇧"}</span>
                      {l === "ar" ? t.arabic : t.english}
                      {lang === l && <span className="block text-[10px] text-green-600 mt-0.5">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sounds */}
              <div>
                <label className="text-green-900 text-xs uppercase tracking-wider block mb-3">{t.sounds}</label>
                <button
                  onClick={handleSoundToggle}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                    soundOn
                      ? "bg-green-900/20 border-green-800/40"
                      : "bg-white/5 border-white/8"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-5 h-5 ${soundOn ? "text-green-400" : "text-green-900"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {soundOn ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M6.343 9.343a8 8 0 000 11.314" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      )}
                    </svg>
                    <span className={`text-sm font-medium ${soundOn ? "text-green-300" : "text-green-800"}`}>
                      {t.sounds}
                    </span>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${soundOn ? "bg-green-600" : "bg-white/10"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${soundOn ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </button>
              </div>

              {/* Version info */}
              <div className="pt-2 border-t border-white/5">
                <p className="text-green-900 text-xs text-center">TermChat · Firebase · Real-time</p>
              </div>
            </>
          )}
        </div>

        {/* Close */}
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
