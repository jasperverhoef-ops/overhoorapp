import { useState, useEffect } from 'react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    // Icon + text animate in (CSS handles this)
    const holdTimer = setTimeout(() => setPhase('hold'), 600);
    const outTimer = setTimeout(() => setPhase('out'), 1800);
    const doneTimer = setTimeout(onDone, 2300);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-cyan-600 via-teal-500 to-emerald-500 transition-opacity duration-500 ${
        phase === 'out' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background rings */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="splash-ring splash-ring-1" />
        <div className="splash-ring splash-ring-2" />
        <div className="splash-ring splash-ring-3" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="splash-particle"
            style={{
              left: `${8 + (i * 7.5) % 85}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${2 + (i % 3) * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Logo + text */}
      <div className="relative flex flex-col items-center">
        {/* Glow behind icon */}
        <div className="absolute w-32 h-32 rounded-full bg-white/20 blur-2xl splash-glow" />

        {/* App icon */}
        <div
          className={`relative w-24 h-24 rounded-3xl bg-white/95 shadow-2xl shadow-black/20 flex items-center justify-center mb-6 splash-icon ${
            phase === 'in' ? 'splash-icon-enter' : ''
          }`}
        >
          {/* Speech bubble SVG matching favicon */}
          <svg viewBox="0 0 100 100" className="w-16 h-16">
            <g transform="translate(50,42)">
              <path
                d="M-28,-22 Q-28,-28 -22,-28 L22,-28 Q28,-28 28,-22 L28,8 Q28,14 22,14 L4,14 L-2,24 L-8,14 L-22,14 Q-28,14 -28,8 Z"
                fill="white"
                stroke="#0891b2"
                strokeWidth="2"
              />
              <text
                x="-12"
                y="2"
                fontFamily="Arial, sans-serif"
                fontWeight="900"
                fontSize="26"
                fill="#0891b2"
              >
                A
              </text>
              <path
                d="M10,-6 L15,2 L24,-12"
                stroke="#22c55e"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
            <g transform="translate(80,14)">
              <path
                d="M0,-7 L1.8,-1.8 L7,0 L1.8,1.8 L0,7 L-1.8,1.8 L-7,0 L-1.8,-1.8 Z"
                fill="#fbbf24"
                className="splash-sparkle"
              />
            </g>
            <g transform="translate(18,22)">
              <path
                d="M0,-5 L1.2,-1.2 L5,0 L1.2,1.2 L0,5 L-1.2,1.2 L-5,0 L-1.2,-1.2 Z"
                fill="#fbbf24"
                opacity="0.8"
                className="splash-sparkle-delayed"
              />
            </g>
          </svg>
        </div>

        {/* App name */}
        <h1 className="text-4xl font-extrabold text-white tracking-tight splash-title">
          TaalTrainer
        </h1>

        {/* Tagline */}
        <p className="text-white/70 text-base mt-2 splash-subtitle">
          Train je woordjes
        </p>

        {/* Loading bar */}
        <div className="mt-8 w-40 h-1 rounded-full bg-white/20 overflow-hidden">
          <div className="splash-progress h-full rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
}
