import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, doc, setDoc,
  query, serverTimestamp, Timestamp, getDoc,
  where, getDocs, updateDoc, arrayUnion
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface Room {
  id: string;
  name: string;
  type: "group" | "dm";
  members: string[];
  createdBy: string;
  createdAt: Timestamp | null;
  lastMessage: string;
  lastMessageAt: Timestamp | null;
}

export function useRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (!user) return;
    // No orderBy to avoid requiring a composite Firestore index
    // We sort client-side instead
    const q = query(
      collection(db, "rooms"),
      where("members", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Room[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Room, "id">),
      }));
      // Sort client-side: rooms with recent messages first
      list.sort((a, b) => {
        const aTime = a.lastMessageAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
        const bTime = b.lastMessageAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
        return bTime - aTime;
      });
      setRooms(list);
    });
    return unsub;
  }, [user]);

  const createGroup = async (name: string, memberUids: string[]): Promise<string> => {
    if (!user) return "";
    const members = Array.from(new Set([user.uid, ...memberUids]));
    const ref = await addDoc(collection(db, "rooms"), {
      name,
      type: "group",
      members,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
    });
    return ref.id;
  };

  const openDM = async (otherUid: string): Promise<string> => {
    if (!user) return "";
    const ids = [user.uid, otherUid].sort();
    const dmId = ids.join("__dm__");
    const ref = doc(db, "rooms", dmId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: dmId,
        type: "dm",
        members: ids,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
    }
    return dmId;
  };

  const ensureGeneralRoom = async () => {
    if (!user) return;
    const q = query(
      collection(db, "rooms"),
      where("name", "==", "general"),
      where("type", "==", "group")
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(db, "rooms"), {
        name: "general",
        type: "group",
        members: [user.uid],
        createdBy: "system",
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
    } else {
      const roomRef = snap.docs[0].ref;
      const data = snap.docs[0].data();
      if (!data.members?.includes(user.uid)) {
        await updateDoc(roomRef, { members: arrayUnion(user.uid) });
      }
    }
  };

  return { rooms, createGroup, openDM, ensureGeneralRoom };
}
