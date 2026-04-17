import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "ar" | "en";

const translations = {
  en: {
    appName: "TERMCHAT",
    channels: "Channels",
    directMessages: "Direct Messages",
    users: "Users",
    online: "online",
    offline: "Offline",
    newChannel: "+ new",
    exit: "exit",
    settings: "Settings",
    noChannels: "No channels yet",
    noOtherUsers: "No other users yet",
    noMessages: "No messages yet",
    sendFirst: "Send the first message!",
    noResults: "No messages found",
    messagePlaceholder: "Message...",
    replyPlaceholder: "Reply to",
    captionPlaceholder: "Add caption...",
    typing: "typing",
    people: "people",
    today: "Today",
    yesterday: "Yesterday",
    members: "members",
    online2: "Online",
    selectRoom: "Select a channel or conversation from the sidebar to start messaging",
    endToEnd: "End-to-end · Real-time · Firebase",
    account: "Account",
    preferences: "Preferences",
    language: "Language",
    sounds: "Sounds",
    soundOn: "On",
    soundOff: "Off",
    editProfile: "Edit Profile",
    saveProfile: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    displayName: "Display Name",
    bio: "About",
    email: "Email",
    memberSince: "Member since",
    close: "Close",
    uploadPhoto: "Change Photo",
    chooseLanguage: "Interface Language",
    arabic: "العربية",
    english: "English",
    profileUpdated: "Profile updated!",
    bioPlaceholder: "Write something about yourself...",
    namePlaceholder: "Your display name",
    sendMessage: "Send Message",
    deleteRoom: "Delete",
    deleteRoomConfirm: "All messages will be permanently deleted. This cannot be undone.",
    deleteRoomTitle: "Delete",
    cancelDelete: "Cancel",
    deleting: "Deleting...",
    search: "Search messages...",
    searchResults: "result",
    searchResultsPlural: "results",
  },
  ar: {
    appName: "تيرم‌شات",
    channels: "القنوات",
    directMessages: "الرسائل المباشرة",
    users: "المستخدمون",
    online: "متصل",
    offline: "غير متصل",
    newChannel: "+ جديد",
    exit: "خروج",
    settings: "الإعدادات",
    noChannels: "لا توجد قنوات بعد",
    noOtherUsers: "لا يوجد مستخدمون آخرون",
    noMessages: "لا توجد رسائل بعد",
    sendFirst: "أرسل أول رسالة!",
    noResults: "لا توجد نتائج",
    messagePlaceholder: "رسالة...",
    replyPlaceholder: "رد على",
    captionPlaceholder: "أضف تعليقاً...",
    typing: "يكتب",
    people: "أشخاص",
    today: "اليوم",
    yesterday: "أمس",
    members: "أعضاء",
    online2: "متصل",
    selectRoom: "اختر قناة أو محادثة من الشريط الجانبي للبدء",
    endToEnd: "تشفير كامل · فوري · Firebase",
    account: "الحساب",
    preferences: "التفضيلات",
    language: "اللغة",
    sounds: "الأصوات",
    soundOn: "مفعّل",
    soundOff: "معطّل",
    editProfile: "تعديل الملف",
    saveProfile: "حفظ",
    cancel: "إلغاء",
    saving: "جاري الحفظ...",
    displayName: "الاسم",
    bio: "نبذة عني",
    email: "البريد الإلكتروني",
    memberSince: "عضو منذ",
    close: "إغلاق",
    uploadPhoto: "تغيير الصورة",
    chooseLanguage: "لغة الواجهة",
    arabic: "العربية",
    english: "English",
    profileUpdated: "تم تحديث الملف الشخصي!",
    bioPlaceholder: "اكتب شيئاً عن نفسك...",
    namePlaceholder: "اسمك المعروض",
    sendMessage: "إرسال رسالة",
    deleteRoom: "حذف",
    deleteRoomConfirm: "ستُحذف جميع الرسائل بشكل دائم ولا يمكن التراجع.",
    deleteRoomTitle: "حذف",
    cancelDelete: "إلغاء",
    deleting: "جاري الحذف...",
    search: "ابحث في الرسائل...",
    searchResults: "نتيجة",
    searchResultsPlural: "نتائج",
  },
};

export type T = typeof translations.en;

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("tc-lang") as Lang) ?? "ar";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("tc-lang", l);
  };

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang], isRTL: lang === "ar" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
