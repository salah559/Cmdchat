import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User, onAuthStateChanged, signInWithPopup, signOut,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string, photoURL: string | null, bio?: string) => Promise<void>;
  updateStatus: (statusText: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        await setDoc(doc(db, "users", u.uid), {
          uid: u.uid,
          displayName: u.displayName ?? "Anonymous",
          photoURL: u.photoURL ?? null,
          email: u.email ?? null,
          status: "online",
          lastSeen: serverTimestamp(),
          joinedAt: serverTimestamp(),
        }, { merge: true });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      await setDoc(doc(db, "users", user.uid), { lastSeen: serverTimestamp(), status: "online" }, { merge: true });
    }, 30000);
    const handleOffline = () => {
      setDoc(doc(db, "users", user.uid), { status: "offline", lastSeen: serverTimestamp() }, { merge: true });
    };
    window.addEventListener("beforeunload", handleOffline);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleOffline();
      else setDoc(doc(db, "users", user.uid), { status: "online", lastSeen: serverTimestamp() }, { merge: true });
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleOffline);
    };
  }, [user]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    if (user) {
      await setDoc(doc(db, "users", user.uid), { status: "offline", lastSeen: serverTimestamp() }, { merge: true });
    }
    await signOut(auth);
  };

  const updateProfile = async (displayName: string, photoURL: string | null, bio?: string) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), {
      displayName,
      photoURL,
      bio: bio ?? "",
    }, { merge: true });
    await updateFirebaseProfile(user, {
      displayName,
      photoURL: photoURL ?? undefined,
    });
  };

  const updateStatus = async (statusText: string) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { statusText });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, updateProfile, updateStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
