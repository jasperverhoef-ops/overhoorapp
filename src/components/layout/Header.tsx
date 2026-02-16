import { useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function Header({ title, showBack, right }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isNested = location.pathname.split('/').filter(Boolean).length > 1;
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const toggleSound = useAppStore((s) => s.toggleSound);

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="flex items-center h-14 px-4">
        {(showBack || isNested) && (
          <button
            onClick={() => navigate(-1)}
            className="mr-2 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            aria-label="Terug"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}

        {child && !isNested && (
          <button
            onClick={() => navigate('/')}
            className="mr-2 flex items-center gap-2 touch-manipulation"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: child.avatarColor }}
            >
              {child.name.charAt(0)}
            </div>
          </button>
        )}

        <h1 className="text-lg font-bold text-gray-900 truncate flex-1">{title}</h1>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 touch-manipulation"
            aria-label={soundEnabled ? 'Geluid uit' : 'Geluid aan'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {right}
        </div>
      </div>
    </header>
  );
}
