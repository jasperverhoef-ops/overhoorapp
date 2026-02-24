import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { Trophy, Star, Clock, Target } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../ui/Button';
import { formatTime } from '../../lib/formatTime';
import { getHardestWords } from '../../lib/roundEngine';
import { calculateSessionXp, calculateTotalXp } from '../../lib/xpSystem';
import { XpEarned } from './XpEarned';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import type { RoundResult, Word } from '../../models/types';
import { useTimerStore } from '../../stores/useTimerStore';

interface SessionCompleteProps {
  childName: string;
  listName: string;
  rounds: RoundResult[];
  allWords: Word[];
  onFinish: () => void;
}

export function SessionComplete({ childName, listName, rounds, allWords, onFinish }: SessionCompleteProps) {
  const navigate = useNavigate();
  const elapsedMs = useTimerStore((s) => s.elapsedMs);
  const selectedChildId = useAppStore((s) => s.selectedChildId);

  const isPerfect = rounds.length <= 2 &&
    rounds.every((r) => r.directCorrect === r.totalWords);

  // Gather all answers across all rounds for hardest words calculation
  const allAnswers = rounds.flatMap((r) => r.answers);
  const hardestWords = getHardestWords(allAnswers, allWords);

  // Calculate overall score for encouragement
  const totalCorrect = rounds.reduce((sum, r) => sum + r.directCorrect, 0);
  const totalWords = rounds.reduce((sum, r) => sum + r.totalWords, 0);
  const scorePercentage = totalWords > 0 ? (totalCorrect / totalWords) * 100 : 0;

  // Calculate XP for this session
  const sessionXp = useMemo(() => {
    // Build a fake session object to calculate XP
    const fakeSession = {
      id: '',
      childId: '',
      listId: '',
      status: 'completed' as const,
      startedAt: 0,
      totalElapsedMs: elapsedMs,
      rounds,
    };
    return calculateSessionXp(fakeSession);
  }, [rounds, elapsedMs]);

  // Get previous sessions to calculate total XP before this session
  const previousSessions = useLiveQuery(
    () =>
      selectedChildId
        ? db.sessions
            .where('childId')
            .equals(selectedChildId)
            .and((s) => s.status === 'completed')
            .toArray()
        : [],
    [selectedChildId]
  );

  const totalXpBefore = useMemo(
    () => calculateTotalXp(previousSessions ?? []),
    [previousSessions]
  );

  // Get encouragement message based on performance (memoized to avoid re-randomizing on re-render)
  const encouragementMessage = useMemo(() => {
    const pick = (messages: string[]) => messages[Math.floor(Math.random() * messages.length)];

    if (isPerfect) {
      return pick([
        'Ongelooflijk! Alles goed in \u00e9\u00e9n keer! \u{1F31F}',
        'Perfecte score! Je bent een woordenmeester! \u{1F3C6}',
        'Wauw! Geen enkele fout gemaakt! \u{1F4AF}',
        'Fantastisch! Alles perfect onthouden! \u2B50',
      ]);
    } else if (scorePercentage >= 90) {
      return pick([
        'Super gedaan! Bijna alles goed! \u{1F389}',
        'Uitstekend werk! Je hebt het bijna helemaal gekend! \u{1F44F}',
        'Geweldig! Je zit er bijna! \u{1F31F}',
        'Top prestatie! Nog even oefenen en het is perfect! \u{1F4AA}',
      ]);
    } else if (scorePercentage >= 75) {
      return pick([
        'Goed gedaan! Je maakt mooie vooruitgang! \u{1F44D}',
        'Prima werk! Blijf zo doorgaan! \u{1F4DA}',
        'Lekker bezig! Je leert ze steeds beter! \u{1F4A1}',
        'Mooi resultaat! Je bent op de goede weg! \u2B50',
      ]);
    } else {
      return pick([
        'Goed geprobeerd! Oefening baart kunst! \u{1F4AA}',
        'Prima begin! Blijf oefenen, het wordt makkelijker! \u{1F4D6}',
        'Je kunt het! Probeer het morgen nog eens! \u{1F331}',
        'Goed bezig! Elke sessie leer je meer! \u{1F3AF}',
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPerfect, scorePercentage >= 90, scorePercentage >= 75]);

  // Trigger confetti for perfect score
  useEffect(() => {
    if (isPerfect) {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#fbbf24', '#f59e0b', '#d97706'],
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#fbbf24', '#f59e0b', '#d97706'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [isPerfect]);

  const handleNewSession = () => {
    onFinish();
    navigate('/play');
  };

  const handleDashboard = () => {
    onFinish();
    navigate('/stats');
  };

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-amber-50 to-white">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
          isPerfect ? 'bg-amber-100' : 'bg-green-100'
        }`}>
          {isPerfect ? (
            <Star className="w-10 h-10 text-amber-500" />
          ) : (
            <Trophy className="w-10 h-10 text-green-600" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {isPerfect ? 'Perfect Score!' : 'Sessie voltooid!'}
        </h2>
        <p className="text-gray-500 mb-2">
          {childName} - {listName}
        </p>

        {/* Encouragement message */}
        <p className="text-lg font-medium text-gray-700 mb-4 text-center px-4">
          {encouragementMessage}
        </p>

        {/* XP Earned */}
        <div className="mb-4">
          <XpEarned
            xpEarned={sessionXp}
            totalXpBefore={totalXpBefore}
            totalXpAfter={totalXpBefore + sessionXp}
          />
        </div>

        {/* Total time */}
        <div className="flex items-center gap-2 bg-white rounded-xl px-5 py-3 shadow-sm border border-gray-100 mb-6">
          <Clock className="w-5 h-5 text-blue-500" />
          <span className="text-sm text-gray-500">Totale tijd:</span>
          <span className="text-xl font-bold text-gray-900 font-mono">
            {formatTime(elapsedMs)}
          </span>
        </div>

        {/* Round results */}
        <div className="w-full max-w-xs space-y-2 mb-6">
          {rounds.map((round) => {
            const pct = Math.round((round.directCorrect / round.totalWords) * 100);
            const colorStyles = {
              1: { bg: 'bg-blue-50', text: 'text-blue-800', bold: 'text-blue-900' },
              2: { bg: 'bg-green-50', text: 'text-green-800', bold: 'text-green-900' },
              3: { bg: 'bg-red-50', text: 'text-red-800', bold: 'text-red-900' },
            } as const;
            const styles = colorStyles[round.roundNumber];

            return (
              <div
                key={round.roundNumber}
                className={`flex items-center justify-between ${styles.bg} rounded-xl px-4 py-3`}
              >
                <span className={`font-medium ${styles.text}`}>
                  Ronde {round.roundNumber}
                </span>
                <span className={`font-bold ${styles.bold}`}>
                  {round.roundNumber === 3
                    ? `${round.difficultWordCount} woorden gekend`
                    : `${round.directCorrect}/${round.totalWords} (${pct}%)`
                  }
                </span>
              </div>
            );
          })}
        </div>

        {/* Perfect score message */}
        {isPerfect && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-6 text-center max-w-xs">
            <p className="text-amber-800 font-medium">
              Geen Ronde 3 nodig - alles meteen goed!
            </p>
          </div>
        )}

        {/* Hardest words */}
        {hardestWords.length > 0 && (
          <div className="w-full max-w-xs mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Moeilijkste woorden
              </h3>
            </div>
            <div className="space-y-1.5">
              {hardestWords.map(({ word, attempts }) => (
                <div
                  key={word.id}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {word.sourceWord}
                  </span>
                  <span className="text-xs text-gray-400">
                    {attempts} pogingen
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-gray-400 mb-6">
          Herhaal over 2-3 dagen voor beste resultaat
        </p>

        {/* Actions */}
        <div className="w-full max-w-xs space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={handleNewSession}>
            Nieuwe sessie
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={handleDashboard}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
