import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Grid2X2, Keyboard, ArrowLeft, Zap, LayoutGrid, Car, ClipboardCheck } from 'lucide-react';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { LANGUAGE_FLAGS } from '../models/types';

type Difficulty = 'Makkelijk' | 'Gemiddeld' | 'Moeilijk';

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  Makkelijk: 'bg-green-100 text-green-700',
  Gemiddeld:  'bg-amber-100 text-amber-700',
  Moeilijk:   'bg-red-100 text-red-700',
};

function HangmanIcon() {
  return (
    <svg className="w-5 h-5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="22" x2="12" y2="22" />
      <line x1="7" y1="22" x2="7" y2="4" />
      <line x1="7" y1="4" x2="16" y2="4" />
      <line x1="16" y1="4" x2="16" y2="7" />
      <circle cx="16" cy="9" r="2" />
      <line x1="16" y1="11" x2="16" y2="16" />
      <line x1="14" y1="13" x2="18" y2="13" />
      <line x1="14" y1="18" x2="16" y2="16" />
      <line x1="18" y1="18" x2="16" y2="16" />
    </svg>
  );
}

interface ModeConfig {
  route: string;
  label: string;
  difficulty: Difficulty;
  icon: React.ReactNode;
  cardCls: string;
  iconBgCls: string;
}

const MODES: ModeConfig[] = [
  {
    route: 'race',
    label: 'Race',
    difficulty: 'Makkelijk',
    icon: <Car className="w-5 h-5 text-cyan-600" />,
    cardCls: 'border-cyan-100 hover:border-cyan-400 active:bg-cyan-50',
    iconBgCls: 'bg-cyan-100',
  },
  {
    route: 'blitz',
    label: 'Swipe Blitz',
    difficulty: 'Makkelijk',
    icon: <Zap className="w-5 h-5 text-orange-600" />,
    cardCls: 'border-orange-100 hover:border-orange-400 active:bg-orange-50',
    iconBgCls: 'bg-orange-100',
  },
  {
    route: 'memory',
    label: 'Memory',
    difficulty: 'Gemiddeld',
    icon: <LayoutGrid className="w-5 h-5 text-pink-600" />,
    cardCls: 'border-pink-100 hover:border-pink-400 active:bg-pink-50',
    iconBgCls: 'bg-pink-100',
  },
  {
    route: 'mc',
    label: 'Multiple Choice',
    difficulty: 'Gemiddeld',
    icon: <Grid2X2 className="w-5 h-5 text-blue-600" />,
    cardCls: 'border-blue-100 hover:border-blue-400 active:bg-blue-50',
    iconBgCls: 'bg-blue-100',
  },
  {
    route: 'hangman',
    label: 'Galgje',
    difficulty: 'Moeilijk',
    icon: <HangmanIcon />,
    cardCls: 'border-violet-100 hover:border-violet-400 active:bg-violet-50',
    iconBgCls: 'bg-violet-100',
  },
  {
    route: 'typing',
    label: 'Typen',
    difficulty: 'Moeilijk',
    icon: <Keyboard className="w-5 h-5 text-green-600" />,
    cardCls: 'border-green-100 hover:border-green-400 active:bg-green-50',
    iconBgCls: 'bg-green-100',
  },
];

export function SelfPlaySelectPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const selectedChildId = useAppStore((s) => s.selectedChildId);

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  const list = useLiveQuery(
    () => (listId ? db.wordLists.get(listId) : undefined),
    [listId]
  );

  if (!child || !list) return null;

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header — list name inline to save vertical space */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => navigate(`/play/${listId}/mode`)}
            className="mr-2 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            aria-label="Terug"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <span className="text-xl mr-2">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
          <h1 className="text-base font-bold text-gray-900 truncate flex-1">{list.name}</h1>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 max-w-md mx-auto w-full flex flex-col">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Kies een spelmodus
        </p>

        {/* 2-column grid — sorted easy → hard */}
        <div className="grid grid-cols-2 gap-2 w-full">
          {MODES.map((mode) => (
            <button
              key={mode.route}
              onClick={() => navigate(`/play/${listId}/self/${mode.route}`)}
              className={`flex flex-col items-center gap-2 bg-white rounded-xl p-3 border-2 hover:shadow-md transition-all touch-manipulation ${mode.cardCls}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode.iconBgCls}`}>
                {mode.icon}
              </div>
              <span className="text-sm font-bold text-gray-900 text-center leading-tight">{mode.label}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_BADGE[mode.difficulty]}`}>
                {mode.difficulty}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gradient-to-b from-blue-50 to-white px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Toets</span>
          </div>
        </div>

        {/* Eindtoets — full width */}
        <button
          onClick={() => navigate(`/play/${listId}/self/eindtoets`)}
          className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-slate-200 hover:border-slate-400 hover:shadow-lg active:bg-slate-50 transition-all touch-manipulation text-left"
        >
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-5 h-5 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Eindtoets</h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Toets</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Bereid je voor op de echte toets — je krijgt een cijfer</p>
          </div>
        </button>

      </div>
    </div>
  );
}
