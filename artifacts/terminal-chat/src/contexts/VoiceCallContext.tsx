import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import {
  collection, doc, addDoc, updateDoc, onSnapshot, getDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] },
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
    // We avoid composite index by only querying calleeId and filtering status in memory
    const q = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid)
    );
    return onSnapshot(q, (snap) => {
      if (snap.empty) return;
      // Get the most recent calling doc
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => d.status === "calling")
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      if (docs.length > 0) {
        const d = docs[0];
        setCallState(prev => prev.status !== "idle" ? prev : {
          callId: d.id, status: "incoming", remoteUserId: d.callerId,
          roomId: d.roomId, isCaller: false, errorMsg: null,
        });
      }
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
      remoteAudioRef.current.oncanplay = () => {
        remoteAudioRef.current?.play().catch(e => console.warn("Autoplay blocked:", e));
      };
    }
    return remoteAudioRef.current;
  };

  const micError = (e: any) => {
    console.error("Voice error detail:", e);
    
    if (e?.code === "permission-denied") {
      return "خطأ: قاعدة البيانات ترفض الطلب. يرجى التحقق من Firestore Rules.";
    }

    if (!window.isSecureContext) {
      return "خطأ في الأمان: الاتصال الصوتي يتطلب رابط آمن (HTTPS) ليعمل.";
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return "متصفحك لا يدعم ميزات الاتصال الصوتي. يرجى استخدام متصفح حديث.";
    }

    if (e instanceof DOMException) {
      if (e.name === "NotAllowedError") {
        return "تعذّر الوصول إلى الميكروفون — يرجى منح الإذن في إعدادات المتصفح.";
      }
      if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        return "لم يتم العثور على ميكروفون — يرجى التأكد من توصيله بجهازك.";
      }
    }

    return "فشل الاتصال بالصوت - تأكد من اتصال الإنترنت وحاول مرة أخرى.";
  };

  /* ── startCall ── */
  const startCall = useCallback(async (calleeId: string, roomId: string) => {
    if (!user || callStateRef.current.status !== "idle") return;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCallState({ ...IDLE, status: "error", remoteUserId: calleeId, errorMsg: micError(new Error("Insecure or unsupported")) });
      return;
    }

    setCallState({ callId: null, status: "calling", remoteUserId: calleeId, roomId, isCaller: true, errorMsg: null });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const audio = getAudioEl();
      const { pc, candidateQueue } = buildPC((rs) => { audio.srcObject = rs; });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // 1. Create call doc with empty candidate arrays
      const callRef = await addDoc(collection(db, "calls"), {
        callerId: user.uid,
        calleeId,
        roomId,
        status: "calling",
        callerCandidates: [],
        calleeCandidates: [],
        createdAt: serverTimestamp(),
      });
      const callId = callRef.id;

      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          const snap = await getDoc(callRef);
          const current = snap.data()?.callerCandidates || [];
          await updateDoc(callRef, { callerCandidates: [...current, e.candidate.toJSON()] });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });

      setCallState(prev => ({ ...prev, callId }));

      const callUnsub = onSnapshot(doc(db, "calls", callId), async (snap) => {
        const data = snap.data();
        if (!data) return;
        
        // Handle Answer
        if (data.answer && !pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processQueue(pc, candidateQueue);
        }
        
        // Handle callee ICE candidates from array
        if (data.calleeCandidates && data.calleeCandidates.length > 0) {
          for (const cand of data.calleeCandidates) {
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
            } else {
              if (!candidateQueue.find(q => q.candidate === cand.candidate)) {
                candidateQueue.push(cand);
              }
            }
          }
        }
        
        if (data.status === "active" && callStateRef.current.status !== "active") {
          setCallState(prev => ({ ...prev, status: "active" }));
          startTimer();
        }
        
        if (data.status === "ended" || data.status === "rejected") {
          await cleanup(callId, false);
        }
      });

      unsubRef.current = [callUnsub];

    } catch (err: any) {
      console.error("startCall error:", err);
      let msg = micError(err);
      if (err.code === "permission-denied") msg = "خطأ: تأكد من ضبط قواعد حماية Firebase (Firestore Rules) للسماح بالكتابة في مجموعة calls";
      setCallState(prev => ({ ...prev, status: "error", errorMsg: msg }));
    }
  }, [user, cleanup]);

  /* ── acceptCall ── */
  const acceptCall = useCallback(async () => {
    if (!user || !callStateRef.current.callId) return;
    const callId = callStateRef.current.callId;
    
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCallState(prev => ({ ...prev, status: "error", errorMsg: micError(new Error("Insecure or unsupported")) }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const audio = getAudioEl();
      const { pc, candidateQueue } = buildPC((rs) => { audio.srcObject = rs; });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const callRef = doc(db, "calls", callId);
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          const snap = await getDoc(callRef);
          const current = snap.data()?.calleeCandidates || [];
          await updateDoc(callRef, { calleeCandidates: [...current, e.candidate.toJSON()] });
        }
      };

      const snap = await getDoc(callRef);
      const data = snap.data()!;
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await processQueue(pc, candidateQueue);

      // Add caller candidates that were already in the doc
      if (data.callerCandidates) {
        for (const cand of data.callerCandidates) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(callRef, { 
        answer: { type: answer.type, sdp: answer.sdp }, 
        status: "active" 
      });

      setCallState(prev => ({ ...prev, status: "active" }));
      startTimer();

      const callUnsub = onSnapshot(callRef, async (snap) => {
        const d = snap.data();
        if (!d) return;

        // Watch for late caller candidates
        if (d.callerCandidates) {
          for (const cand of d.callerCandidates) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
          }
        }

        if (d.status === "ended") await cleanup(callId, false);
      });

      unsubRef.current = [callUnsub];
    } catch (err: any) {
      console.error("acceptCall error:", err);
      let msg = micError(err);
      if (err.code === "permission-denied") msg = "خطأ في الصلاحيات: تحقق من إعدادات Firestore";
      setCallState(prev => ({ ...prev, status: "error", errorMsg: msg }));
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
