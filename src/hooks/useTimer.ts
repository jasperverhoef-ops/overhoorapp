import { useEffect, useRef } from 'react';
import { useTimerStore } from '../stores/useTimerStore';

export function useTimer() {
  const isRunning = useTimerStore((s) => s.isRunning);
  const elapsedMs = useTimerStore((s) => s.elapsedMs);
  const tick = useTimerStore((s) => s.tick);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const reset = useTimerStore((s) => s.reset);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isRunning) return;

    const loop = () => {
      tick();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, tick]);

  return { elapsedMs, isRunning, start, pause, resume, reset };
}
