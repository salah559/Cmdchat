import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

function getKey(uid: string, roomId: string) {
  return `tc-lastread-${uid}-${roomId}`;
}

export function useUnread() {
  const { user } = useAuth();
  const [lastReadMap, setLastReadMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const map: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`tc-lastread-${user.uid}-`)) {
        const roomId = key.replace(`tc-lastread-${user.uid}-`, "");
        const val = Number(localStorage.getItem(key));
        if (val) map[roomId] = val;
      }
    }
    setLastReadMap(map);
  }, [user]);

  const markRead = useCallback((roomId: string) => {
    if (!user) return;
    const now = Date.now();
    localStorage.setItem(getKey(user.uid, roomId), String(now));
    setLastReadMap((prev) => ({ ...prev, [roomId]: now }));
  }, [user]);

  const isUnread = useCallback((roomId: string, lastMessageAt: { toMillis: () => number } | null): boolean => {
    if (!lastMessageAt) return false;
    const lastRead = lastReadMap[roomId] ?? 0;
    return lastMessageAt.toMillis() > lastRead;
  }, [lastReadMap]);

  return { markRead, isUnread };
}
