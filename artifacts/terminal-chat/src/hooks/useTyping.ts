import { useEffect, useRef, useCallback } from "react";
import { doc, updateDoc, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useState } from "react";

export function useTyping(roomId: string | null) {
  const { user } = useAuth();
  const users = useUsers();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!roomId) { setTypingUsers([]); return; }
    const unsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      const data = snap.data();
      const typing = data?.typing as Record<string, Timestamp> | undefined;
      if (!typing) { setTypingUsers([]); return; }
      const now = Date.now();
      const active = Object.entries(typing)
        .filter(([uid, ts]) => uid !== user?.uid && ts && (now - ts.toMillis()) < 6000)
        .map(([uid]) => {
          const u = users.find((u) => u.uid === uid);
          return u?.displayName ?? "Someone";
        });
      setTypingUsers(active);
    });
    return unsub;
  }, [roomId, user?.uid, users]);

  const setTyping = useCallback(async () => {
    if (!roomId || !user) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    try {
      await updateDoc(doc(db, "rooms", roomId), {
        [`typing.${user.uid}`]: serverTimestamp(),
      });
    } catch { /* ignore */ }
    typingTimer.current = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "rooms", roomId), {
          [`typing.${user.uid}`]: null,
        });
      } catch { /* ignore */ }
      isTypingRef.current = false;
    }, 4000);
  }, [roomId, user]);

  const clearTyping = useCallback(async () => {
    if (!roomId || !user) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    try {
      await updateDoc(doc(db, "rooms", roomId), {
        [`typing.${user.uid}`]: null,
      });
    } catch { /* ignore */ }
  }, [roomId, user]);

  return { typingUsers, setTyping, clearTyping };
}
