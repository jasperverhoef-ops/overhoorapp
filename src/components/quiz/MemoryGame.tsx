import { useState, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { TimerDisplay } from './TimerDisplay';
import { ProgressBar } from '../ui/ProgressBar';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { shuffle } from '../../lib/shuffleUtils';
import type { Word, Language, Direction, AnswerResult } from '../../models/types';

interface MemoryGameProps {
  round: 1 | 2 | 3;
  words: Word[];
  sourceLanguage: Language;
  childName: string;
  direction: Direction;
  onComplete: (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => void;
  onQuit: () => void;
}

interface MemoryCard {
  id: string;       // unique card id
  wordId: string;   // word id this card belongs to
  text: string;     // text shown on the card
  type: 'source' | 'dutch'; // which side of the pair
}

const MAX_PAIRS = 6; // max pairs per game to keep grid manageable

export function MemoryGame({
  round,
  words,
  sourceLanguage,
  childName,
  direction,
  onComplete,
  onQuit,
}: MemoryGameProps) {
  // Take a subset of words for this memory round
  const gameWords = useMemo(() => {
    const shuffled = shuffle([...words]);
    return shuffled.slice(0, MAX_PAIRS);
  }, [words]);

  // Build cards
  const cards = useMemo(() => {
    const allCards: MemoryCard[] = [];
    for (const w of gameWords) {
      allCards.push({
        id: `${w.id}-source`,
        wordId: w.id,
        text: w.sourceWord,
        type: 'source',
      });
      allCards.push({
        id: `${w.id}-dutch`,
        wordId: w.id,
        text: w.dutchWord,
        type: 'dutch',
      });
    }
    return shuffle(allCards);
  }, [gameWords]);

  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<Set<string>>(new Set()); // matched wordIds
  const [selected, setSelected] = useState<MemoryCard[]>([]);
  const [lockBoard, setLockBoard] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showComplete, setShowComplete] = useState(false);

  const isSourceToDutch = direction === 'source-to-dutch';
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2194 NL`
    : `NL \u2194 ${LANGUAGE_LABELS[sourceLanguage]}`;
  const displayFlag = LANGUAGE_FLAGS[sourceLanguage];

  const roundColors = {
    1: { badge: 'bg-blue-100 text-blue-700', progress: 'bg-blue-500', label: 'Ronde 1' },
    2: { badge: 'bg-green-100 text-green-700', progress: 'bg-green-500', label: 'Ronde 2' },
    3: { badge: 'bg-red-100 text-red-700', progress: 'bg-red-500', label: 'Ronde 3' },
  };
  const colors = roundColors[round];

  // Check if game is complete
  useEffect(() => {
    if (matched.size === gameWords.length && gameWords.length > 0 && !showComplete) {
      setShowComplete(true);
      // Report all words as correct (memory game = all matched eventually)
      setTimeout(() => {
        const results = gameWords.map((w) => ({
          wordId: w.id,
          direction,
          result: 'correct' as AnswerResult,
        }));
        // Also report any words NOT in this batch as "not attempted" (they'll be in the next batch)
        onComplete(results);
      }, 1500);
    }
  }, [matched, gameWords, direction, onComplete, showComplete]);

  const handleCardClick = useCallback((card: MemoryCard) => {
    if (lockBoard) return;
    if (flipped.has(card.id)) return;
    if (matched.has(card.wordId) && selected.length === 0) return;

    const newFlipped = new Set(flipped);
    newFlipped.add(card.id);
    setFlipped(newFlipped);

    const newSelected = [...selected, card];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setAttempts((prev) => prev + 1);
      setLockBoard(true);

      const [first, second] = newSelected;
      if (first.wordId === second.wordId && first.type !== second.type) {
        // Match!
        setMatched((prev) => {
          const next = new Set(prev);
          next.add(first.wordId);
          return next;
        });
        // Haptic
        if (navigator.vibrate) navigator.vibrate(50);
        setSelected([]);
        setLockBoard(false);
      } else {
        // No match — flip back after delay
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        setTimeout(() => {
          setFlipped((prev) => {
            const next = new Set(prev);
            next.delete(first.id);
            next.delete(second.id);
            return next;
          });
          setSelected([]);
          setLockBoard(false);
        }, 800);
      }
    }
  }, [lockBoard, flipped, matched, selected]);

  // Determine grid columns based on number of cards
  const totalCards = cards.length;
  const gridCols = totalCards <= 8 ? 'grid-cols-4' : totalCards <= 12 ? 'grid-cols-4' : 'grid-cols-4';

  return (
    <div className="min-h-full flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{childName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
              {colors.label}
            </span>
            <span className="text-xs text-gray-500">{directionLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TimerDisplay />
          <button
            onClick={onQuit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Stop quiz"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-gray-500">
            {matched.size}/{gameWords.length} paren gevonden
          </span>
          <span className="text-sm text-gray-500">
            {attempts} pogingen
          </span>
        </div>
        <ProgressBar
          current={matched.size}
          total={gameWords.length}
          color={colors.progress}
          showLabel={false}
        />
      </div>

      {/* Memory info */}
      <div className="px-4 pt-3 flex items-center justify-center gap-2">
        <span className="text-2xl">{displayFlag}</span>
        <span className="text-sm font-medium text-gray-600">Vind de paren!</span>
      </div>

      {/* Card grid */}
      <div className="flex-1 px-3 py-4 flex items-center justify-center">
        <div className={`grid ${gridCols} gap-2 w-full max-w-md`}>
          {cards.map((card) => {
            const isFlipped = flipped.has(card.id);
            const isMatched = matched.has(card.wordId);

            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(card)}
                disabled={isMatched && !lockBoard}
                className={`relative aspect-[3/4] rounded-xl font-semibold text-sm transition-all duration-300 touch-manipulation border-2 flex items-center justify-center p-1 ${
                  isMatched
                    ? 'bg-green-100 border-green-400 text-green-800'
                    : isFlipped
                      ? card.type === 'source'
                        ? 'bg-pink-50 border-pink-400 text-pink-800'
                        : 'bg-blue-50 border-blue-400 text-blue-800'
                      : 'bg-gradient-to-br from-pink-200 to-purple-200 border-purple-300 text-transparent hover:from-pink-300 hover:to-purple-300 active:scale-95'
                }`}
              >
                {isFlipped || isMatched ? (
                  <span className="text-center break-words leading-tight">
                    {card.text}
                  </span>
                ) : (
                  <span className="text-2xl">?</span>
                )}
                {/* Language indicator */}
                {(isFlipped || isMatched) && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] opacity-50">
                    {card.type === 'source' ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Completion overlay */}
      {showComplete && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10">
          <div className="text-6xl mb-4">{'\u{1F389}'}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Alle paren gevonden!</h2>
          <p className="text-gray-500">In {attempts} pogingen</p>
        </div>
      )}
    </div>
  );
}
