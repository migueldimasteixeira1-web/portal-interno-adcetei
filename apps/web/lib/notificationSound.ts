const VOICE_DEBOUNCE_MS = 25000;
const CROSS_TAB_LOCK_MS = 3000;

let voiceAudio: HTMLAudioElement | null = null;
let standardAudio: HTMLAudioElement | null = null;
let lastVoicePlayedAt = 0;

function getVoiceAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!voiceAudio) voiceAudio = new Audio("/sounds/new-ticket.mp3");
  return voiceAudio;
}

function getStandardAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!standardAudio) standardAudio = new Audio("/sounds/notification.mp3");
  return standardAudio;
}

function claimCrossTabSlot(key: string): boolean {
  if (typeof window === "undefined") return true;
  const now = Date.now();
  const last = Number(window.localStorage.getItem(key) || 0);
  if (now - last < CROSS_TAB_LOCK_MS) return false;
  window.localStorage.setItem(key, String(now));
  return true;
}

// Voz de "novo chamado": só a primeira ocorrência de uma rajada toca, o
// resto cai no som padrão (regra explícita da proposta de notificações sonoras).
export function playVoiceNotification() {
  const now = Date.now();
  if (now - lastVoicePlayedAt < VOICE_DEBOUNCE_MS) return;
  if (!claimCrossTabSlot("notif_voice_lock")) return;
  lastVoicePlayedAt = now;
  getVoiceAudio()?.play().catch(() => {});
}

export function playStandardNotification() {
  if (!claimCrossTabSlot("notif_standard_lock")) return;
  getStandardAudio()?.play().catch(() => {});
}
