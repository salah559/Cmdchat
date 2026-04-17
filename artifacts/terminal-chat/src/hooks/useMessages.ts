import { useState, useEffect } from "react";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, Timestamp, doc, updateDoc, limit, arrayUnion, arrayRemove
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface ReplyInfo {
  id: string;
  text: string;
  displayName: string;
  imageUrl?: string;
}

export interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp | null;
  type?: "system" | "message";
  reactions?: Record<string, string[]>;
  replyTo?: ReplyInfo;
  readBy?: string[];
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

  const sendMessage = async (text: string, imageUrl?: string, replyTo?: ReplyInfo) => {
    if (!roomId || !user) return;
    if (!text.trim() && !imageUrl) return;

    const msg: Record<string, unknown> = {
      text: text.trim(),
      uid: user.uid,
      displayName: user.displayName ?? "Anonymous",
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      type: "message",
      readBy: [user.uid],
    };
    if (imageUrl) msg.imageUrl = imageUrl;
    if (replyTo) {
      const replyData: Record<string, unknown> = {
        id: replyTo.id,
        text: replyTo.text,
        displayName: replyTo.displayName,
      };
      if (replyTo.imageUrl) replyData.imageUrl = replyTo.imageUrl;
      msg.replyTo = replyData;
    }

    await addDoc(collection(db, "rooms", roomId, "messages"), msg);
    await updateDoc(doc(db, "rooms", roomId), {
      lastMessage: imageUrl ? "📷 Photo" : text.trim().slice(0, 80),
      lastMessageAt: serverTimestamp(),
    });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!roomId || !user) return;
    const msgRef = doc(db, "rooms", roomId, "messages", messageId);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const hasReacted = msg.reactions?.[emoji]?.includes(user.uid);
    if (hasReacted) {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(user.uid) });
    } else {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(user.uid) });
    }
  };

  const markRead = async (messageId: string) => {
    if (!roomId || !user) return;
    const msgRef = doc(db, "rooms", roomId, "messages", messageId);
    await updateDoc(msgRef, { readBy: arrayUnion(user.uid) });
  };

  return { messages, sendMessage, toggleReaction, markRead };
}
