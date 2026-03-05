import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { speakWord, stopSpeaking } from '../lib/tts';
import type { Language } from '../models/types';

/**
 * Auto-speak a word when it changes or when TTS is toggled on.
 * Stops speech on unmount.
 * Pass enabled=false to suppress speaking (e.g. when game is over).
 * Returns the current ttsEnabled state.
 */
export function useAutoSpeak(
  word: string,
  language: Language | 'nl',
  wordId: string,
  enabled = true,
) {
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);
  const shouldSpeak = ttsEnabled && enabled;
  const isFirstRender = useRef(true);
  const prevShouldSpeakRef = useRef(shouldSpeak);
  const prevWordIdRef = useRef(wordId);

  useEffect(() => {
    const isFirst = isFirstRender.current;
    isFirstRender.current = false;

    const wordChanged = wordId !== prevWordIdRef.current;
    const justEnabled = shouldSpeak && !prevShouldSpeakRef.current;

    if (shouldSpeak && word && (isFirst || wordChanged || justEnabled)) {
      speakWord(word, language);
    }

    prevShouldSpeakRef.current = shouldSpeak;
    prevWordIdRef.current = wordId;
  }, [shouldSpeak, wordId, word, language]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  return ttsEnabled;
}
