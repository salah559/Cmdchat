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

export type CallStatus = "idle" | "calling" | "incoming" | "active" | "error";

export interface CallState {
  callId: string | null;
  status: CallStatus;
  remoteUserId: string | null;
  roomId: string | null;
  isCaller: boolean;
  errorMsg: string | null;
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

const IDLE: CallState = { callId: null, status: "idle", remoteUserId: null, roomId: null, isCaller: false, errorMsg: null };

const VoiceCallContext = createContext<VoiceCallContextType | null>(null);

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>(IDLE);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const unsubRef = useRef<Array<() => void>>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  /* ── timers ── */
  const stopTimer = () => {
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    setCallDuration(0);
  };
  const startTimer = () => {
    stopTimer();
    let s = 0;
    durationTimerRef.current = setInterval(() => { s++; setCallDuration(s); }, 1000);
  };

  /* ── cleanup ── */
  const cleanup = useCallback(async (callId?: string | null, updateFs = true) => {
    unsubRef.current.forEach(u => u());
    unsubRef.current = [];
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    stopTimer();
    const id = callId ?? callStateRef.current.callId;
    if (id && updateFs) { try { await updateDoc(doc(db, "calls", id), { status: "ended" }); } catch {} }
    setCallState(IDLE);
    setIsMuted(false);
  }, []);

  /* ── listen for incoming calls ── */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid),
      where("status", "==", "calling"),
    );
    return onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const d = snap.docs[0];
      const data = d.data();
      setCallState(prev => prev.status !== "idle" ? prev : {
        callId: d.id, status: "incoming", remoteUserId: data.callerId,
        roomId: data.roomId, isCaller: false, errorMsg: null,
      });
    });
  }, [user]);

  /* ── helpers ── */
  const buildPC = (onTrack: (s: MediaStream) => void) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const rs = new MediaStream();
    pc.ontrack = (e) => { e.streams[0]?.getTracks().forEach(t => rs.addTrack(t)); onTrack(rs); };
    pcRef.current = pc;
    return pc;
  };
  const getAudioEl = () => {
    if (!remoteAudioRef.current) { remoteAudioRef.current = new Audio(); remoteAudioRef.current.autoplay = true; }
    return remoteAudioRef.current;
  };
  const micError = (e: unknown) => {
    const msg = (e instanceof DOMException && e.name === "NotAllowedError")
      ? "تعذّر الوصول إلى الميكروفون — تأكد من منح الإذن في المتصفح"
      : "فشل الاتصال بالصوت";
    return msg;
  };

  /* ── startCall ── */
  const startCall = useCallback(async (calleeId: string, roomId: string) => {
    if (!user || callStateRef.current.status !== "idle") return;

    // 1. Show UI immediately
    setCallState({ callId: null, status: "calling", remoteUserId: calleeId, roomId, isCaller: true, errorMsg: null });

    try {
      // 2. Request mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // 3. Build peer connection
      const audio = getAudioEl();
      const pc = buildPC((rs) => { audio.srcObject = rs; });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // 4. Create Firestore call doc
      const callRef = await addDoc(collection(db, "calls"), {
        callerId: user.uid, calleeId, roomId, status: "calling", createdAt: serverTimestamp(),
      });
      const callId = callRef.id;

      // 5. ICE handler
      pc.onicecandidate = async (e) => {
        if (e.candidate) await addDoc(collection(db, "calls", callId, "callerCandidates"), e.candidate.toJSON());
      };

      // 6. Create + send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });

      setCallState(prev => ({ ...prev, callId }));

      // 7. Watch for answer
      const callUnsub = onSnapshot(doc(db, "calls", callId), async (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.answer && !pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        if (data.status === "active") { setCallState(prev => ({ ...prev, status: "active" })); startTimer(); }
        if (data.status === "ended" || data.status === "rejected") await cleanup(callId, false);
      });

      // 8. Watch for callee ICE candidates
      const iceUnsub = onSnapshot(collection(db, "calls", callId, "calleeCandidates"), (snap) => {
        snap.docChanges().forEach(async (ch) => {
          if (ch.type === "added") try { await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())); } catch {}
        });
      });

      unsubRef.current = [callUnsub, iceUnsub];

    } catch (err) {
      console.error("startCall error:", err);
      // Keep modal open but show error
      setCallState(prev => ({ ...prev, status: "error", errorMsg: micError(err) }));
    }
  }, [user, cleanup]);

  /* ── acceptCall ── */
  const acceptCall = useCallback(async () => {
    if (!user || !callStateRef.current.callId) return;
    const callId = callStateRef.current.callId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const audio = getAudioEl();
      const pc = buildPC((rs) => { audio.srcObject = rs; });
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
      startTimer();

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
      console.error("acceptCall error:", err);
      setCallState(prev => ({ ...prev, status: "error", errorMsg: micError(err) }));
    }
  }, [user, cleanup]);

  /* ── rejectCall ── */
  const rejectCall = useCallback(async () => {
    const id = callStateRef.current.callId;
    if (id) try { await updateDoc(doc(db, "calls", id), { status: "rejected" }); } catch {}
    setCallState(IDLE);
  }, []);

  /* ── endCall ── */
  const endCall = useCallback(() => cleanup(), [cleanup]);

  /* ── toggleMute ── */
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
