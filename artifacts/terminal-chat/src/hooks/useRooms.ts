import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, doc, setDoc,
  query, serverTimestamp, Timestamp, getDoc,
  where, getDocs, updateDoc, arrayUnion, arrayRemove, writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface Room {
  id: string;
  name: string;
  description?: string;
  type: "group" | "dm";
  members: string[];
  createdBy: string;
  createdAt: Timestamp | null;
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  pinnedMessageId?: string | null;
  archived?: boolean;
}

export function useRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "rooms"),
      where("members", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Room[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Room, "id">),
      }));
      list.sort((a, b) => {
        const aTime = a.lastMessageAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
        const bTime = b.lastMessageAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
        return bTime - aTime;
      });
      setRooms(list);
    });
    return unsub;
  }, [user]);

  const createGroup = async (name: string, memberUids: string[], description?: string): Promise<string> => {
    if (!user) return "";
    const members = Array.from(new Set([user.uid, ...memberUids]));
    const ref = await addDoc(collection(db, "rooms"), {
      name,
      description: description ?? "",
      type: "group",
      members,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      archived: false,
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
        archived: false,
      });
    }
    return dmId;
  };

  const deleteRoom = async (roomId: string): Promise<void> => {
    const messagesRef = collection(db, "rooms", roomId, "messages");
    const msgSnap = await getDocs(messagesRef);
    const batch = writeBatch(db);
    msgSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "rooms", roomId));
    await batch.commit();
  };

  const archiveRoom = async (roomId: string): Promise<void> => {
    await updateDoc(doc(db, "rooms", roomId), { archived: true });
  };

  const unarchiveRoom = async (roomId: string): Promise<void> => {
    await updateDoc(doc(db, "rooms", roomId), { archived: false });
  };

  const pinMessage = async (roomId: string, messageId: string): Promise<void> => {
    await updateDoc(doc(db, "rooms", roomId), { pinnedMessageId: messageId });
  };

  const unpinMessage = async (roomId: string): Promise<void> => {
    await updateDoc(doc(db, "rooms", roomId), { pinnedMessageId: null });
  };

  const kickMember = async (roomId: string, uid: string): Promise<void> => {
    await updateDoc(doc(db, "rooms", roomId), { members: arrayRemove(uid) });
  };

  const updateRoom = async (roomId: string, data: { name?: string; description?: string }): Promise<void> => {
    await updateDoc(doc(db, "rooms", roomId), data);
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
        description: "",
        type: "group",
        members: [user.uid],
        createdBy: "system",
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
        archived: false,
      });
    } else {
      const roomRef = snap.docs[0].ref;
      const data = snap.docs[0].data();
      if (!data.members?.includes(user.uid)) {
        await updateDoc(roomRef, { members: arrayUnion(user.uid) });
      }
    }
  };

  return { rooms, createGroup, openDM, deleteRoom, archiveRoom, unarchiveRoom, pinMessage, unpinMessage, kickMember, updateRoom, ensureGeneralRoom };
}
