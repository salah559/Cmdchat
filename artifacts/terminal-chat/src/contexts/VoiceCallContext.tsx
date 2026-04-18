import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import {
  collection, doc, addDoc, updateDoc, onSnapshot, getDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
};

export type CallStatus = "idle" | "calling" | "incoming" | "active";

export interface CallState {
  callId: string | null;
  status: CallStatus;
  remoteUserId: string | null;
  roomId: string | null;
  isCaller: boolean;
}

interface VoiceCallContextType {
  callState: CallState;
  isMuted: boolean;
  callDuration: number;
  startCall: (calleeId: string, roomId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
}

const VoiceCallContext = createContext<VoiceCallContextType | null>(null);

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    callId: null, status: "idle", remoteUserId: null, roomId: null, isCaller: false,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const unsubRef = useRef<Array<() => void>>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  const stopDurationTimer = () => {
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    setCallDuration(0);
  };

  const startDurationTimer = () => {
    stopDurationTimer();
    let s = 0;
    durationTimerRef.current = setInterval(() => { s++; setCallDuration(s); }, 1000);
  };

  const cleanup = useCallback(async (callId?: string | null, updateStatus = true) => {
    unsubRef.current.forEach(u => u());
    unsubRef.current = [];

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    stopDurationTimer();

    const id = callId ?? callStateRef.current.callId;
    if (id && updateStatus) {
      try { await updateDoc(doc(db, "calls", id), { status: "ended" }); } catch {}
    }

    setCallState({ callId: null, status: "idle", remoteUserId: null, roomId: null, isCaller: false });
    setIsMuted(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid),
      where("status", "==", "calling"),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const d = snap.docs[0];
      const data = d.data();
      setCallState(prev => {
        if (prev.status !== "idle") return prev;
        return { callId: d.id, status: "incoming", remoteUserId: data.callerId, roomId: data.roomId, isCaller: false };
      });
    });
    return unsub;
  }, [user]);

  const buildPC = (onTrack: (s: MediaStream) => void) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteStream = new MediaStream();
    pc.ontrack = (e) => { e.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t)); onTrack(remoteStream); };
    pcRef.current = pc;
    return pc;
  };

  const getAudio = () => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
    return remoteAudioRef.current;
  };

  const startCall = useCallback(async (calleeId: string, roomId: string) => {
    if (!user || callStateRef.current.status !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const audio = getAudio();
      const pc = buildPC((remoteStream) => { audio.srcObject = remoteStream; });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const callRef = await addDoc(collection(db, "calls"), {
        callerId: user.uid, calleeId, roomId, status: "calling", createdAt: serverTimestamp(),
      });
      const callId = callRef.id;

      pc.onicecandidate = async (e) => {
        if (e.candidate) await addDoc(collection(db, "calls", callId, "callerCandidates"), e.candidate.toJSON());
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });

      setCallState({ callId, status: "calling", remoteUserId: calleeId, roomId, isCaller: true });

      const callUnsub = onSnapshot(doc(db, "calls", callId), async (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.answer && pc.remoteDescription === null) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        if (data.status === "active") {
          setCallState(prev => ({ ...prev, status: "active" }));
          startDurationTimer();
        }
        if (data.status === "ended" || data.status === "rejected") await cleanup(callId, false);
      });

      const iceUnsub = onSnapshot(collection(db, "calls", callId, "calleeCandidates"), (snap) => {
        snap.docChanges().forEach(async (ch) => {
          if (ch.type === "added") try { await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())); } catch {}
        });
      });

      unsubRef.current = [callUnsub, iceUnsub];
    } catch (err) {
      console.error("Call failed:", err);
      await cleanup(null, false);
    }
  }, [user, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!user || !callStateRef.current.callId) return;
    const callId = callStateRef.current.callId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const audio = getAudio();
      const pc = buildPC((remoteStream) => { audio.srcObject = remoteStream; });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.onicecandidate = async (e) => {
        if (e.candidate) await addDoc(collection(db, "calls", callId, "calleeCandidates"), e.candidate.toJSON());
      };

      const snap = await getDoc(doc(db, "calls", callId));
      const data = snap.data()!;
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(doc(db, "calls", callId), { answer: { type: answer.type, sdp: answer.sdp }, status: "active" });

      setCallState(prev => ({ ...prev, status: "active" }));
      startDurationTimer();

      const iceUnsub = onSnapshot(collection(db, "calls", callId, "callerCandidates"), (snap) => {
        snap.docChanges().forEach(async (ch) => {
          if (ch.type === "added") try { await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())); } catch {}
        });
      });

      const callUnsub = onSnapshot(doc(db, "calls", callId), async (snap) => {
        const d = snap.data();
        if (d?.status === "ended") await cleanup(callId, false);
      });

      unsubRef.current = [iceUnsub, callUnsub];
    } catch (err) {
      console.error("Accept failed:", err);
      await cleanup(callId, false);
    }
  }, [user, cleanup]);

  const rejectCall = useCallback(async () => {
    const id = callStateRef.current.callId;
    if (id) try { await updateDoc(doc(db, "calls", id), { status: "rejected" }); } catch {}
    setCallState({ callId: null, status: "idle", remoteUserId: null, roomId: null, isCaller: false });
  }, []);

  const endCall = useCallback(() => cleanup(), [cleanup]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  }, []);

  return (
    <VoiceCallContext.Provider value={{ callState, isMuted, callDuration, startCall, acceptCall, rejectCall, endCall, toggleMute }}>
      {children}
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within VoiceCallProvider");
  return ctx;
}
