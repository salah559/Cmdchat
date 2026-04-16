import { useState, useEffect } from "react";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ChatUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  status: "online" | "offline";
  lastSeen: Timestamp | null;
}

export function useUsers() {
  const [users, setUsers] = useState<ChatUser[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list: ChatUser[] = snap.docs.map((d) => {
        const data = d.data();
        const lastSeen = data.lastSeen as Timestamp | null;
        let status: "online" | "offline" = data.status ?? "offline";
        if (status === "online" && lastSeen) {
          const diff = Date.now() - lastSeen.toMillis();
          if (diff > 90000) status = "offline";
        }
        return {
          uid: d.id,
          displayName: data.displayName ?? "Unknown",
          photoURL: data.photoURL ?? null,
          email: data.email ?? null,
          status,
          lastSeen,
        };
      });
      list.sort((a, b) => {
        if (a.status === b.status) return a.displayName.localeCompare(b.displayName);
        return a.status === "online" ? -1 : 1;
      });
      setUsers(list);
    });
    return unsub;
  }, []);

  return users;
}
