let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, type: OscillatorType, duration: number, gainVal: number, startTime: number) {
  const ctx = getAudioCtx();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function playMessageSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(880, "sine", 0.12, 0.15, now);
    playTone(1100, "sine", 0.1, 0.1, now + 0.07);
  } catch {
    // AudioContext blocked or unavailable
  }
}

export function playSentSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(660, "sine", 0.08, 0.08, now);
    playTone(880, "sine", 0.08, 0.06, now + 0.05);
  } catch {
    // ignore
  }
}

export function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(440, "sine", 0.15, 0.12, now);
    playTone(550, "sine", 0.15, 0.1, now + 0.1);
    playTone(660, "sine", 0.2, 0.12, now + 0.2);
  } catch {
    // ignore
  }
}

let soundEnabled = localStorage.getItem("tc-sounds") !== "off";

export function isSoundEnabled() {
  return soundEnabled;
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("tc-sounds", soundEnabled ? "on" : "off");
  return soundEnabled;
}
