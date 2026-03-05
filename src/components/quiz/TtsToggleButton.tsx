import { Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

interface TtsToggleButtonProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
}

export function TtsToggleButton({ variant = 'light', size = 'md' }: TtsToggleButtonProps) {
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);
  const toggleTts = useAppStore((s) => s.toggleTts);

  const sizeClass = size === 'sm' ? 'p-1.5' : 'p-2';
  const activeClass = variant === 'dark'
    ? 'text-blue-400 bg-blue-500/20'
    : 'text-blue-500 bg-blue-50';
  const inactiveClass = variant === 'dark'
    ? 'text-slate-600 hover:text-slate-400'
    : 'text-gray-300 hover:bg-gray-100';

  return (
    <button
      onClick={toggleTts}
      className={`${sizeClass} rounded-lg transition-colors touch-manipulation ${
        ttsEnabled ? activeClass : inactiveClass
      }`}
      aria-label={ttsEnabled ? 'Voorlezen uit' : 'Voorlezen aan'}
      title={ttsEnabled ? 'Voorlezen uit' : 'Voorlezen aan'}
    >
      {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
    </button>
  );
}
