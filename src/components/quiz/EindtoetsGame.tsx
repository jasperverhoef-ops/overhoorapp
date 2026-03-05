import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ClipboardCheck, ChevronRight, X, ChevronDown, Share2, Volume2, VolumeX } from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { shuffle } from '../../lib/shuffleUtils';
import { useAppStore } from '../../stores/useAppStore';
import { speakWord } from '../../lib/tts';
import type { Word, Language, Direction, AnswerResult } from '../../models/types';

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isCloseEnough(input: string, correct: string): boolean {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(correct);
  if (a === b) return true;
  const dist = levenshtein(a, b);
  if (b.length >= 6 && dist <= 2) return true;
  if (b.length >= 3 && dist <= 1) return true;
  return false;
}

interface ToetsWord {
  word: Word;
  direction: Direction;
  correctAnswer: string;
  questionWord: string;
}

interface ToetsResult {
  word: Word;
  direction: Direction;
  givenAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

interface EindtoetsGameProps {
  words: Word[];
  sourceLanguage: Language;
  childName: string;
  childId: string;
  listId: string;
  onComplete: (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => void;
  onQuit: () => void;
}

function calculateGrade(correct: number, total: number): number {
  if (total === 0) return 1;
  return Math.round((1 + (correct / total) * 9) * 10) / 10;
}

function getGradeColor(grade: number): string {
  if (grade >= 8) return 'text-emerald-600';
  if (grade >= 6) return 'text-blue-600';
  if (grade >= 5.5) return 'text-amber-600';
  return 'text-red-600';
}

function getGradeBg(grade: number): string {
  if (grade >= 8) return 'border-emerald-200 bg-emerald-50';
  if (grade >= 6) return 'border-blue-200 bg-blue-50';
  if (grade >= 5.5) return 'border-amber-200 bg-amber-50';
  return 'border-red-200 bg-red-50';
}

function getGradeMessage(grade: number, childName: string): string {
  if (grade >= 9) return `Uitstekend, ${childName}!`;
  if (grade >= 8) return `Heel goed, ${childName}!`;
  if (grade >= 7) return `Goed gedaan, ${childName}.`;
  if (grade >= 6) return `Voldoende, ${childName}.`;
  if (grade >= 5.5) return 'Net voldoende. Oefen de moeilijke woorden nog eens.';
  if (grade >= 4) return 'Onvoldoende. Er is nog werk aan de winkel.';
  return 'Oefen de woorden nog een keer goed door.';
}

function saveEindtoetsGrade(childId: string, listId: string, grade: number): void {
  try {
    const key = `eindtoets-${childId}-${listId}`;
    const data = JSON.stringify({ grade, timestamp: Date.now() });
    localStorage.setItem(key, data);
  } catch { /* ignore */ }
}

export function getEindtoetsGrade(childId: string, listId: string): { grade: number; timestamp: number } | null {
  try {
    const key = `eindtoets-${childId}-${listId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function EindtoetsGame({
  words,
  sourceLanguage,
  childName,
  childId,
  listId,
  onComplete,
  onQuit,
}: EindtoetsGameProps) {
  const toetsQueue = useMemo(() => {
    return shuffle([...words]).map((w): ToetsWord => {
      const direction: Direction = Math.random() < 0.5 ? 'source-to-dutch' : 'dutch-to-source';
      return {
        word: w,
        direction,
        correctAnswer: direction === 'source-to-dutch' ? w.dutchWord : w.sourceWord,
        questionWord: direction === 'source-to-dutch' ? w.sourceWord : w.dutchWord,
      };
    });
  }, [words]);

  const [phase, setPhase] = useState<'intro' | 'testing' | 'calculating' | 'results'>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ToetsResult[]>([]);
  const [showWrongAnswers, setShowWrongAnswers] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);
  const toggleTts = useAppStore((s) => s.toggleTts);

  const current = toetsQueue[currentIndex];
  const totalWords = toetsQueue.length;

  const isSourceToDutch = current?.direction === 'source-to-dutch';
  const displayFlag = current
    ? isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}'
    : '';
  const displayLanguage = current
    ? isSourceToDutch ? sourceLanguage : 'nl' as const
    : 'nl' as const;

  const directionLabel = current
    ? isSourceToDutch
      ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
      : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`
    : '';

  // Speak word
  useEffect(() => {
    if (ttsEnabled && phase === 'testing' && current) {
      speakWord(current.questionWord, displayLanguage);
    }
  }, [ttsEnabled, currentIndex, phase, current, displayLanguage]);

  // Focus input
  useEffect(() => {
    if (phase === 'testing') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase, currentIndex]);

  // Calculating phase → show results after delay
  useEffect(() => {
    if (phase === 'calculating') {
      const timer = setTimeout(() => setPhase('results'), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleSubmit = useCallback(() => {
    if (!current) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    const correct = isCloseEnough(trimmed, current.correctAnswer);

    setResults(prev => [...prev, {
      word: current.word,
      direction: current.direction,
      givenAnswer: trimmed,
      correctAnswer: current.correctAnswer,
      isCorrect: correct,
    }]);

    setInput('');
    if (currentIndex + 1 >= totalWords) {
      setPhase('calculating');
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [current, input, currentIndex, totalWords]);

  const handleFinish = useCallback(() => {
    const mapped = results.map(r => ({
      wordId: r.word.id,
      direction: r.direction,
      result: (r.isCorrect ? 'correct' : 'wrong') as AnswerResult,
    }));
    const correctCount = results.filter(r => r.isCorrect).length;
    const grade = calculateGrade(correctCount, totalWords);
    saveEindtoetsGrade(childId, listId, grade);
    onComplete(mapped);
  }, [results, totalWords, childId, listId, onComplete]);

  // Intro screen
  if (phase === 'intro') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ClipboardCheck className="w-8 h-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Eindtoets</h1>
          <p className="text-gray-500 mb-6">
            Typ de vertaling van elk woord. Je krijgt na afloop een cijfer.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Aantal woorden</span>
              <span className="font-semibold text-gray-900">{totalWords}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Richting</span>
              <span className="font-semibold text-gray-900">Willekeurig</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Herkansing</span>
              <span className="font-semibold text-gray-900">Nee</span>
            </div>
          </div>
          <button
            onClick={() => setPhase('testing')}
            className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-semibold text-lg active:scale-[0.98] transition-transform touch-manipulation"
          >
            Start toets
          </button>
          <button
            onClick={onQuit}
            className="w-full mt-3 py-2.5 text-gray-500 font-medium text-sm"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  // Calculating screen — build suspense
  if (phase === 'calculating') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-white px-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <ClipboardCheck className="w-8 h-8 text-slate-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Je cijfer wordt berekend...</h2>
          <p className="text-gray-400 text-sm">Even geduld</p>
          <div className="mt-6 flex justify-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2.5 h-2.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Results screen
  if (phase === 'results') {
    const correctCount = results.filter(r => r.isCorrect).length;
    const wrongResults = results.filter(r => !r.isCorrect);
    const grade = calculateGrade(correctCount, totalWords);

    const shareText = `${childName} heeft een ${grade % 1 === 0 ? grade : grade.toFixed(1)} gehaald voor de eindtoets! (${correctCount}/${totalWords} goed)`;

    const handleShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Eindtoets resultaat', text: shareText });
        } catch { /* user cancelled */ }
      } else {
        try {
          await navigator.clipboard.writeText(shareText);
          alert('Resultaat gekopieerd naar klembord!');
        } catch { /* ignore */ }
      }
    };

    return (
      <div className="min-h-full flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-8 pb-4 text-center">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Eindcijfer</p>
            <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full border-4 ${getGradeBg(grade)} mb-3`}>
              <span className={`text-5xl font-bold tabular-nums ${getGradeColor(grade)}`}>
                {grade % 1 === 0 ? grade : grade.toFixed(1)}
              </span>
            </div>
            <p className="text-gray-700 font-medium mt-2">{getGradeMessage(grade, childName)}</p>
            <p className="text-sm text-gray-400 mt-1">{correctCount} van {totalWords} goed</p>

            <button
              onClick={handleShare}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-medium text-sm border border-blue-200 active:scale-[0.98] transition-transform touch-manipulation"
            >
              <Share2 className="w-4 h-4" />
              Resultaat delen
            </button>
          </div>

          {wrongResults.length > 0 && (
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowWrongAnswers(prev => !prev)}
                className="flex items-center gap-2 w-full text-left py-2"
              >
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showWrongAnswers ? 'rotate-0' : '-rotate-90'}`} />
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Fout beantwoord ({wrongResults.length})
                </span>
              </button>
              {showWrongAnswers && (
                <div className="space-y-2 mt-2">
                  {wrongResults.map((r, i) => (
                    <div key={i} className="bg-red-50 border border-red-100 rounded-xl p-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {r.direction === 'source-to-dutch' ? r.word.sourceWord : r.word.dutchWord}
                          </p>
                          <p className="text-sm text-red-500 line-through mt-0.5">{r.givenAnswer}</p>
                          <p className="text-sm text-emerald-600 font-medium">{r.correctAnswer}</p>
                        </div>
                        <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-gray-100">
          <button
            onClick={handleFinish}
            className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-semibold text-lg active:scale-[0.98] transition-transform touch-manipulation"
          >
            Klaar
          </button>
        </div>
      </div>
    );
  }

  // Testing phase
  const progressPct = ((currentIndex) / totalWords) * 100;

  return (
    <div className="min-h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-500">
          Vraag {currentIndex + 1}/{totalWords}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTts}
            className={`p-1.5 rounded-lg transition-colors touch-manipulation ${
              ttsEnabled ? 'text-blue-500 bg-blue-50' : 'text-gray-300 hover:bg-gray-100'
            }`}
            aria-label={ttsEnabled ? 'Voorlezen uit' : 'Voorlezen aan'}
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button onClick={onQuit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors" aria-label="Stop">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-slate-400 transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="text-xs text-gray-400 mb-2">{directionLabel}</p>
        <span className="text-2xl mb-2">{displayFlag}</span>
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">{current?.questionWord}</h2>

        {/* Input */}
        <div className="w-full max-w-sm">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="Typ je antwoord..."
            autoComplete="off"
            autoCapitalize="off"
            className="w-full px-4 py-3 text-lg text-center rounded-xl border-2 outline-none transition-colors border-gray-200 focus:border-slate-400 bg-white"
          />
        </div>
      </div>

      {/* Submit button */}
      <div className="px-6 pb-6 pt-3">
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all touch-manipulation flex items-center justify-center gap-2"
        >
          Volgende <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
