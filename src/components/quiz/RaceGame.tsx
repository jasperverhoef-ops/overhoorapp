import { Flag, X, Heart, Zap, Pause, Play } from 'lucide-react';
import type { Word, Language, Direction, AnswerResult } from '../../models/types';
import {
  MAX_LIVES, GATE_HIT_ZONE, LEFT_LANE, RIGHT_LANE,
} from './race/constants';
import { useRaceGameLoop } from './race/useRaceGameLoop';
import { RaceEndScreen } from './race/RaceEndScreen';
import './race/race-animations.css';

interface RaceGameProps {
  words: Word[];
  sourceLanguage: Language;
  childName: string;
  childId: string;
  listId: string;
  onComplete: (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => void;
  onQuit: () => void;
}

export function RaceGame({ words, sourceLanguage, childName, childId, listId, onComplete, onQuit }: RaceGameProps) {
  const {
    countdown, isRacing, gameOver, raceFinished,
    score, lives, streak, bestStreak, totalWords, progressPct, elapsedMs, isNewHighscore,
    displayWord, displayFlag, directionLabel,
    lane, nitro, paused, showFinishLine, gateContent,
    shake, flashResult, particles, scorePopup,
    setLane, togglePause, handleFinish,
    gridRef, dividerRef, gateContainerRef, finishLineRef, scanLineRefs, speedLineRefs,
  } = useRaceGameLoop({ words, sourceLanguage, childId, listId, onComplete });

  const isCountingDown = countdown >= 0;
  const carLaneX = lane === 'left' ? LEFT_LANE : RIGHT_LANE;

  // --- End screens ---
  if (gameOver) {
    return (
      <RaceEndScreen
        variant="game-over"
        score={score} totalWords={totalWords} elapsedMs={elapsedMs}
        lives={lives} bestStreak={bestStreak} childName={childName}
        isNewHighscore={isNewHighscore} onFinish={handleFinish}
      />
    );
  }

  if (raceFinished) {
    return (
      <RaceEndScreen
        variant="finished"
        score={score} totalWords={totalWords} elapsedMs={elapsedMs}
        lives={lives} bestStreak={bestStreak} childName={childName}
        isNewHighscore={isNewHighscore} onFinish={handleFinish}
      />
    );
  }

  // --- Gate panels (shared structure, rendered via map) ---
  const gatePanels = gateContent ? [
    { lane: LEFT_LANE, text: gateContent.correctOnLeft ? gateContent.correctAnswer : gateContent.wrongAnswer },
    { lane: RIGHT_LANE, text: !gateContent.correctOnLeft ? gateContent.correctAnswer : gateContent.wrongAnswer },
  ] : [];

  return (
    <div className={`min-h-full flex flex-col bg-slate-950 select-none overflow-hidden ${shake ? 'race-shake' : ''}`}>
      {/* Top HUD */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/95 border-b border-slate-800/50 z-20 relative backdrop-blur-sm">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <Heart key={i} className={`w-5 h-5 transition-all duration-300 ${i < lives ? 'text-red-500 fill-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]' : 'text-slate-700'}`} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {streak >= 3 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-amber-400 tabular-nums">{streak}x</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30">
            <span className="text-sm font-bold text-cyan-400 tabular-nums">{score}</span>
            <span className="text-xs text-cyan-600">/{totalWords}</span>
          </div>
          <button onClick={togglePause} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors" aria-label={paused ? 'Hervat' : 'Pauze'}>
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
          <button onClick={onQuit} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors" aria-label="Stop">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress track */}
      <div className="px-3 py-1.5 bg-slate-950 z-20 relative">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏎️</span>
          <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-300 ${nitro ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-red-400' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <Flag className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      {/* ===== TRACK AREA ===== */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '280px' }}>
        {/* Dark background */}
        <div className="absolute inset-0 bg-slate-950" />

        {/* Scrolling grid (position updated via ref) */}
        <div
          ref={gridRef}
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,211,238,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Tunnel edges */}
        <div className="absolute top-0 bottom-0 left-[8%] w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-cyan-500/5" />
        <div className="absolute top-0 bottom-0 right-[8%] w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-cyan-500/5" />

        {/* Center divider (dash transforms updated via ref) */}
        <div ref={dividerRef} className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-0.5 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-full h-5 bg-slate-700/50 mb-5" />
          ))}
        </div>

        {/* Active lane highlight */}
        <div className={`absolute top-0 bottom-0 transition-all duration-200 ${lane === 'left' ? 'left-0 right-1/2' : 'left-1/2 right-0'}`}>
          <div className={`absolute inset-0 transition-opacity duration-200 ${nitro ? 'bg-amber-500/[0.04]' : 'bg-cyan-500/[0.03]'}`} />
        </div>

        {/* Scan lines (positions updated via refs) */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`hl-${i}`}
            ref={el => { scanLineRefs.current[i] = el; }}
            className="absolute left-[10%] right-[10%] h-px bg-cyan-500/[0.06]"
          />
        ))}

        {/* Gate container (top + opacity updated via ref, content via React state) */}
        <div
          ref={gateContainerRef}
          className="absolute inset-x-0 z-10 pointer-events-none"
          style={{ display: 'none', top: '-20%', opacity: 0 }}
        >
          {gatePanels.map((panel) => (
            <div
              key={panel.lane}
              className="absolute"
              style={{ left: `${panel.lane}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="px-4 py-2.5 rounded-2xl text-center font-bold text-base min-w-[80px] bg-slate-900/90 border-2 border-cyan-400/50 text-white shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-sm whitespace-nowrap">
                {panel.text}
              </div>
            </div>
          ))}
        </div>

        {/* Finish line (top updated via ref) */}
        {showFinishLine && (
          <div
            ref={finishLineRef}
            className="absolute z-10 left-[10%] right-[10%] h-6 flex"
            style={{ display: 'none', top: '-20%', transform: 'translateY(-50%)' }}
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`flex-1 h-full ${i % 2 === 0 ? 'bg-white' : 'bg-slate-900'}`} />
            ))}
          </div>
        )}

        {/* Car */}
        <div className="absolute z-[11] transition-all duration-150 ease-out" style={{
          top: `${GATE_HIT_ZONE}%`,
          left: `${carLaneX}%`,
          transform: 'translate(-50%, -50%)',
        }}>
          <div className="relative">
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-12 h-4 bg-black/30 rounded-full blur-md" />
            {nitro && (
              <>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                  <div className="w-5 h-9 bg-gradient-to-t from-transparent via-orange-500/80 to-yellow-300 rounded-full blur-[3px] animate-pulse" />
                </div>
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3 h-6 bg-gradient-to-t from-transparent to-red-500/40 rounded-full blur-sm" />
              </>
            )}
            <div className={`absolute -inset-5 rounded-full blur-2xl transition-colors duration-200 ${nitro ? 'bg-amber-400/30' : 'bg-cyan-400/15'}`} />
            <div className={`text-5xl sm:text-6xl transition-transform duration-150 ${nitro ? 'scale-110' : ''}`} style={{
              filter: nitro
                ? 'drop-shadow(0 0 16px rgba(250,204,21,0.7)) drop-shadow(0 0 30px rgba(250,204,21,0.3))'
                : 'drop-shadow(0 0 10px rgba(34,211,238,0.5)) drop-shadow(0 0 20px rgba(34,211,238,0.2))',
            }}>
              🏎️
            </div>
          </div>
        </div>

        {/* Speed lines (positions updated via refs, always rendered but hidden when inactive) */}
        <div className={`absolute inset-0 pointer-events-none z-[5] overflow-hidden ${nitro || streak >= 5 ? '' : 'hidden'}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`sl-${i}`}
              ref={el => { speedLineRefs.current[i] = el; }}
              className="absolute bg-cyan-400/10 rounded-full"
              style={{
                left: i % 2 === 0 ? `${3 + i * 2}%` : `${89 - i * 2}%`,
                width: '1.5px',
                height: nitro ? '50px' : '25px',
                opacity: nitro ? 0.3 : 0.12,
              }}
            />
          ))}
        </div>

        {/* Particles */}
        {particles.length > 0 && (
          <div className="absolute z-[12] pointer-events-none" style={{
            top: `${GATE_HIT_ZONE}%`,
            left: `${carLaneX}%`,
            transform: 'translate(-50%, -50%)',
          }}>
            {particles.map((p) => (
              <div key={p.id} className="absolute w-2.5 h-2.5 rounded-full race-particle-burst" style={{
                backgroundColor: p.color,
                boxShadow: `0 0 8px ${p.color}`,
                '--px': `${Math.cos(p.angle * Math.PI / 180) * p.distance}px`,
                '--py': `${Math.sin(p.angle * Math.PI / 180) * p.distance}px`,
              } as React.CSSProperties} />
            ))}
          </div>
        )}

        {/* Score popup */}
        {scorePopup && (
          <div key={scorePopup.key} className="absolute z-[13] pointer-events-none race-score-float" style={{
            top: `${GATE_HIT_ZONE - 10}%`,
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            <span className={`text-3xl font-black ${
              scorePopup.value >= 5 ? 'text-amber-400' : scorePopup.value >= 3 ? 'text-cyan-400' : 'text-emerald-400'
            }`} style={{
              textShadow: scorePopup.value >= 5
                ? '0 0 16px rgba(251,191,36,0.8)' : scorePopup.value >= 3
                  ? '0 0 14px rgba(34,211,238,0.7)' : '0 0 12px rgba(16,185,129,0.7)',
            }}>
              +1{scorePopup.value >= 3 && <span className="text-xl ml-1">({scorePopup.value}x)</span>}
            </span>
          </div>
        )}

        {/* Flash overlay */}
        {flashResult && (
          <div className={`absolute inset-0 z-[14] pointer-events-none race-flash-fade ${flashResult === 'correct' ? 'bg-emerald-500/15' : 'bg-red-500/20'}`}>
            <div className={`absolute inset-0 ${flashResult === 'correct'
              ? 'shadow-[inset_0_0_80px_rgba(16,185,129,0.4)]'
              : 'shadow-[inset_0_0_80px_rgba(239,68,68,0.5)]'
            }`} />
          </div>
        )}

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none z-[3]" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }} />
      </div>

      {/* Question word */}
      <div className="text-center py-2.5 bg-slate-950 z-20 relative border-t border-slate-800/50">
        <p className="text-[10px] text-slate-500 mb-1">{directionLabel}</p>
        <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-2xl bg-slate-800/80 border border-slate-700/50">
          <span className="text-xl">{displayFlag}</span>
          <h2 className="text-2xl font-bold text-white">{displayWord}</h2>
        </div>
      </div>

      {/* Lane controls */}
      <div className="flex z-20 relative gap-px bg-slate-800/50">
        {(['left', 'right'] as const).map((dir) => (
          <button
            key={dir}
            onPointerDown={() => setLane(dir)}
            className={`flex-1 py-5 flex flex-col items-center justify-center transition-all duration-150 touch-manipulation active:scale-95 ${
              lane === dir ? 'bg-cyan-500/15 border-t-2 border-cyan-400' : 'bg-slate-950 border-t-2 border-transparent'
            }`}
          >
            <span className={`text-3xl transition-transform duration-150 ${lane === dir ? 'scale-110' : ''}`}>
              {dir === 'left' ? '👈' : '👉'}
            </span>
            <span className={`text-xs font-semibold mt-0.5 ${lane === dir ? 'text-cyan-400' : 'text-slate-600'}`}>
              {dir === 'left' ? 'Links' : 'Rechts'}
            </span>
          </button>
        ))}
      </div>

      {/* Countdown overlay */}
      {isCountingDown && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          {countdown > 0 ? (
            <div key={countdown} className="race-countdown-pop">
              <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-500" style={{
                textShadow: '0 0 40px rgba(34,211,238,0.5)',
                WebkitTextStroke: '2px rgba(34,211,238,0.3)',
              }}>
                {countdown}
              </span>
            </div>
          ) : (
            <div key="start" className="race-countdown-start">
              <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400" style={{
                textShadow: '0 0 40px rgba(34,211,238,0.6)',
              }}>
                START!
              </span>
            </div>
          )}
          <p className="text-slate-500 text-sm mt-6">
            {countdown > 0 ? 'Maak je klaar...' : ''}
          </p>
        </div>
      )}

      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="text-5xl mb-4">⏸️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Gepauzeerd</h2>
          <p className="text-slate-400 mb-6">Neem even pauze!</p>
          <button onClick={togglePause} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation">
            Verder racen
          </button>
        </div>
      )}
    </div>
  );
}
