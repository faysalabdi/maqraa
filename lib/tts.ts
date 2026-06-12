"use client";

/**
 * Browser TTS for Arabic via the Web Speech API. Zero-cost listening practice.
 * Voice quality varies by device (best on iOS/macOS and Android with Google TTS).
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

export function getArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedVoice =
    voices.find((v) => v.lang === "ar-SA") ??
    voices.find((v) => v.lang.startsWith("ar")) ??
    null;
  return cachedVoice;
}

export function speakArabic(
  text: string,
  opts: { rate?: number; onEnd?: () => void } = {},
): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getArabicVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "ar-SA";
  utterance.rate = opts.rate ?? 0.85;
  if (opts.onEnd) utterance.onend = opts.onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
