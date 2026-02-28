import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Grid2X2, Keyboard, ArrowLeft, Zap, LayoutGrid, Car, ClipboardCheck } from 'lucide-react';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { LANGUAGE_FLAGS } from '../models/types';

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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => navigate(`/play/${listId}/mode`)}
            className="mr-2 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            aria-label="Terug"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate flex-1">
            Zelf oefenen
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 max-w-md mx-auto w-full">
        {/* List info */}
        <div className="mb-4 text-center">
          <span className="text-3xl mb-1 block">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
          <h2 className="text-lg font-bold text-gray-900">{list.name}</h2>
        </div>

        {/* Game type buttons — sorted easy to hard */}
        <div className="w-full space-y-2">
          {/* EASY */}
          <button
            onClick={() => navigate(`/play/${listId}/self/mc`)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-blue-100 hover:border-blue-400 hover:shadow-lg active:bg-blue-50 transition-all touch-manipulation text-left"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Grid2X2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Multiple Choice</h3>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Easy</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Kies het juiste antwoord uit 4 opties</p>
            </div>
          </button>

          <button
            onClick={() => navigate(`/play/${listId}/self/memory`)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-pink-100 hover:border-pink-400 hover:shadow-lg active:bg-pink-50 transition-all touch-manipulation text-left"
          >
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <LayoutGrid className="w-5 h-5 text-pink-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Memory</h3>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Easy</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Vind de juiste paren door kaarten om te draaien</p>
            </div>
          </button>

          <button
            onClick={() => navigate(`/play/${listId}/self/race`)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-cyan-100 hover:border-cyan-400 hover:shadow-lg active:bg-cyan-50 transition-all touch-manipulation text-left"
          >
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Car className="w-5 h-5 text-cyan-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Race</h3>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Easy</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Bestuur je auto naar het juiste antwoord!</p>
            </div>
          </button>

          {/* MEDIUM */}
          <button
            onClick={() => navigate(`/play/${listId}/self/hangman`)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-violet-100 hover:border-violet-400 hover:shadow-lg active:bg-violet-50 transition-all touch-manipulation text-left"
          >
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
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
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Galgje</h3>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Medium</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Raad letter voor letter het juiste woord!</p>
            </div>
          </button>

          <button
            onClick={() => navigate(`/play/${listId}/self/blitz`)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-orange-100 hover:border-orange-400 hover:shadow-lg active:bg-orange-50 transition-all touch-manipulation text-left"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Swipe Blitz</h3>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Medium</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Swipe goed of fout — zo snel mogelijk!</p>
            </div>
          </button>

          {/* HARD */}
          <button
            onClick={() => navigate(`/play/${listId}/self/typing`)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-green-100 hover:border-green-400 hover:shadow-lg active:bg-green-50 transition-all touch-manipulation text-left"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Keyboard className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Typen</h3>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Hard</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Typ zelf het antwoord — je leert sneller!</p>
            </div>
          </button>

          {/* EINDTOETS — separated with divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gradient-to-b from-blue-50 to-white px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Toets</span>
            </div>
          </div>

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
    </div>
  );
}
