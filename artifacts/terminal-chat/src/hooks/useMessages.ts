import { useState, useEffect } from "react";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, Timestamp, doc, updateDoc, limit
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface Message {
  id: string;
  text: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp | null;
  type?: "system" | "message";
}

export function useMessages(roomId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!roomId) { setMessages([]); return; }
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) })));
    });
    return unsub;
  }, [roomId]);

  const sendMessage = async (text: string) => {
    if (!roomId || !user || !text.trim()) return;
    const msg = {
      text: text.trim(),
      uid: user.uid,
      displayName: user.displayName ?? "Anonymous",
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      type: "message",
    };
    await addDoc(collection(db, "rooms", roomId, "messages"), msg);
    await updateDoc(doc(db, "rooms", roomId), {
      lastMessage: text.trim().slice(0, 80),
      lastMessageAt: serverTimestamp(),
    });
  };

  return { messages, sendMessage };
}
