import type { Language } from '../models/types';

const LANG_MAP: Record<Language, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  la: 'it-IT', // Latin: best approximation is Italian pronunciation
  el: 'el-GR',
  other: 'en-US',
};

/**
 * Speak a word aloud using the Web Speech API.
 * Cancels any currently speaking utterance first.
 */
export function speakWord(text: string, language: Language | 'nl'): void {
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'nl' ? 'nl-NL' : LANG_MAP[language];
  utterance.rate = 0.9;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

/** Stop any ongoing speech. */
export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
