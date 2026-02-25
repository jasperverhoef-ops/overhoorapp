import { Button } from '../ui/Button';
import { LANGUAGE_LABELS } from '../../models/types';
import type { Language, TrainingMode } from '../../models/types';

interface RoundIntroProps {
  round: 1 | 2 | 3;
  sourceLanguage: Language;
  totalWords: number;
  difficultWordCount?: number;
  mode?: TrainingMode;
  onStart: () => void;
}

const roundColors = {
  1: 'from-blue-50 to-blue-100 text-blue-700',
  2: 'from-green-50 to-green-100 text-green-700',
  3: 'from-purple-50 to-purple-100 text-purple-700',
};

const roundBadges = {
  1: 'bg-blue-500',
  2: 'bg-green-500',
  3: 'bg-purple-500',
};

export function RoundIntro({ round, sourceLanguage, totalWords, difficultWordCount, mode, onStart }: RoundIntroProps) {
  const langLabel = LANGUAGE_LABELS[sourceLanguage];

  const descriptions = {
    1: `${langLabel} \u2192 Nederlands`,
    2: `Nederlands \u2192 ${langLabel}`,
    3: 'Bonusronde!',
  };

  const isSelf = mode === 'self';
  const subtitles = {
    1: isSelf
      ? `Kies de juiste Nederlandse vertaling voor elk ${langLabel} woord.`
      : 'Lees het woord in de vreemde taal voor. Het kind zegt de Nederlandse vertaling.',
    2: isSelf
      ? `Kies het juiste ${langLabel} woord voor elke Nederlandse vertaling.`
      : 'Lees het Nederlandse woord voor. Het kind zegt het woord in de vreemde taal.',
    3: `${difficultWordCount} woorden om te oefenen. Krijg ze 2x goed en je hebt ze onder de knie!`,
  };

  return (
    <div className={`min-h-full flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-b ${roundColors[round]}`}>
      <div className={`w-16 h-16 ${roundBadges[round]} rounded-full flex items-center justify-center mb-6 shadow-lg`}>
        <span className="text-2xl font-bold text-white">{round}</span>
      </div>

      <h2 className="text-2xl font-bold mb-2 text-center">{round === 3 ? 'Bonusronde' : `Ronde ${round}`}</h2>
      <p className="text-lg font-medium mb-2 text-center">{descriptions[round]}</p>
      <p className="text-sm opacity-75 text-center mb-2 max-w-xs">{subtitles[round]}</p>
      <p className="text-sm opacity-60 mb-8">
        {round === 3 ? `${difficultWordCount} woorden` : `${totalWords} woorden`}
      </p>

      <Button variant="primary" size="xl" onClick={onStart} className="min-w-[200px]">
        {round === 3 ? 'Start Bonusronde' : `Start Ronde ${round}`}
      </Button>
    </div>
  );
}
