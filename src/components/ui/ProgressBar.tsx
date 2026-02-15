interface ProgressBarProps {
  current: number;
  total: number;
  color?: string;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  current,
  total,
  color = 'bg-blue-500',
  showLabel = true,
  className = '',
}: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`w-full ${className}`}>
      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-sm text-gray-500 mt-1">
          {current}/{total} ({pct}%)
        </p>
      )}
    </div>
  );
}
