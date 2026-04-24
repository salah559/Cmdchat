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
    const remoteStream = new MediaStream();
    
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => {
        remoteStream.addTrack(t);
      });
      onTrack(remoteStream);
    };

    // Keep track of candidates received before remote description
    const candidateQueue: RTCIceCandidateInit[] = [];
    pc.onicecandidateerror = (e) => console.error("ICE Error:", e);
    
    pcRef.current = pc;
    return { pc, candidateQueue };
  };

  const processQueue = async (pc: RTCPeerConnection, queue: RTCIceCandidateInit[]) => {
    while (queue.length > 0) {
      const candidate = queue.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("Failed to add queued candidate:", e);
        }
      }
    }
  };

  const getAudioEl = () => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
      // In some browsers, we need to manually trigger play
      remoteAudioRef.current.oncanplay = () => {
        remoteAudioRef.current?.play().catch(e => console.warn("Autoplay blocked:", e));
      };
    }
    return remoteAudioRef.current;
  };

  const micError = (e: unknown) => {
    console.error("Voice error detail:", e);
    const msg = (e instanceof DOMException && e.name === "NotAllowedError")
      ? "تعذّر الوصول إلى الميكروفون — تأكد من منح الإذن في المتصفح"
      : "فشل الاتصال بالصوت - تأكد من اتصال الإنترنت";
    return msg;
  };

  /* ── startCall ── */
  const startCall = useCallback(async (calleeId: string, roomId: string) => {
    if (!user || callStateRef.current.status !== "idle") return;

    setCallState({ callId: null, status: "calling", remoteUserId: calleeId, roomId, isCaller: true, errorMsg: null });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const audio = getAudioEl();
      const { pc, candidateQueue } = buildPC((rs) => { audio.srcObject = rs; });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const callRef = await addDoc(collection(db, "calls"), {
        callerId: user.uid, calleeId, roomId, status: "calling", createdAt: serverTimestamp(),
      });
      const callId = callRef.id;

      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await addDoc(collection(db, "calls", callId, "callerCandidates"), e.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });

      setCallState(prev => ({ ...prev, callId }));

      const callUnsub = onSnapshot(doc(db, "calls", callId), async (snap) => {
        const data = snap.data();
        if (!data) return;
        
        if (data.answer && !pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processQueue(pc, candidateQueue);
        }
        
        if (data.status === "active" && callStateRef.current.status !== "active") {
          setCallState(prev => ({ ...prev, status: "active" }));
          startTimer();
        }
        
        if (data.status === "ended" || data.status === "rejected") {
          await cleanup(callId, false);
        }
      });

      const iceUnsub = onSnapshot(collection(db, "calls", callId, "calleeCandidates"), (snap) => {
        snap.docChanges().forEach(async (ch) => {
          if (ch.type === "added") {
            const candidate = ch.doc.data() as RTCIceCandidateInit;
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
            } else {
              candidateQueue.push(candidate);
            }
          }
        });
      });

      unsubRef.current = [callUnsub, iceUnsub];

    } catch (err) {
      console.error("startCall error:", err);
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
      const { pc, candidateQueue } = buildPC((rs) => { audio.srcObject = rs; });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await addDoc(collection(db, "calls", callId, "calleeCandidates"), e.candidate.toJSON());
        }
      };

      const snap = await getDoc(doc(db, "calls", callId));
      const data = snap.data()!;
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await processQueue(pc, candidateQueue);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(doc(db, "calls", callId), { 
        answer: { type: answer.type, sdp: answer.sdp }, 
        status: "active" 
      });

      setCallState(prev => ({ ...prev, status: "active" }));
      startTimer();

      const iceUnsub = onSnapshot(collection(db, "calls", callId, "callerCandidates"), (snap) => {
        snap.docChanges().forEach(async (ch) => {
          if (ch.type === "added") {
            const candidate = ch.doc.data() as RTCIceCandidateInit;
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
            } else {
              candidateQueue.push(candidate);
            }
          }
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
    if (track) { 
      track.enabled = !track.enabled; 
      setIsMuted(!track.enabled); 
    }
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
