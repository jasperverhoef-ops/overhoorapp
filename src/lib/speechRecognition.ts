import type { Language } from '../models/types';

// Declare Web Speech API types
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const LANG_MAP: Record<Language, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  la: 'la',  // May not be supported
  el: 'el-GR',
  other: 'nl-NL',
};

export function isSpeechSupported(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function listenForAnswer(
  lang: Language,
  isDutchAnswer: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = isDutchAnswer ? 'nl-NL' : LANG_MAP[lang];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const result = event.results[0][0];
      resolve(result.transcript.toLowerCase().trim());
    };

    recognition.onerror = (event: any) => {
      reject(new Error(event.error));
    };

    recognition.onend = () => {
      // If no result was captured, reject
    };

    recognition.start();

    // Timeout after 5 seconds
    setTimeout(() => {
      recognition.stop();
    }, 5000);
  });
}

export function fuzzyMatch(spoken: string, correct: string): boolean {
  const a = spoken.toLowerCase().trim();
  const b = correct.toLowerCase().trim();
  if (a === b) return true;

  // Allow levenshtein distance of 1 for words < 6 chars, 2 for longer
  const maxDist = b.length < 6 ? 1 : 2;
  return levenshtein(a, b) <= maxDist;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}
