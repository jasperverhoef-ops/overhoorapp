import { Clock } from 'lucide-react';
import { useTimer } from '../../hooks/useTimer';
import { formatTime } from '../../lib/formatTime';

export function TimerDisplay() {
  const { elapsedMs } = useTimer();

  return (
    <div className="flex items-center gap-1.5 text-gray-600 font-mono text-sm tabular-nums">
      <Clock className="w-4 h-4" />
      <span>{formatTime(elapsedMs)}</span>
    </div>
  );
}
