import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Volume2, VolumeX, ChevronDown, Home, Speech } from 'lucide-react';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { Child } from '../../models/types';

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
  const selectChild = useAppStore((s) => s.selectChild);
  const clearChild = useAppStore((s) => s.clearChild);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const toggleSound = useAppStore((s) => s.toggleSound);
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);
  const toggleTts = useAppStore((s) => s.toggleTts);
  const activeSession = useSessionStore((s) => s.active);
  const abandonSession = useSessionStore((s) => s.abandonSession);
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  const allChildren = useLiveQuery(() => db.children.toArray());

  // Close picker when clicking outside
  useEffect(() => {
    if (!showChildPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowChildPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showChildPicker]);

  const handleSwitchChild = (childId: string) => {
    selectChild(childId);
    setShowChildPicker(false);
  };

  const handleHomeClick = () => {
    if (activeSession && activeSession.phase !== 'session-complete') {
      setShowHomeConfirm(true);
    } else {
      goHome();
    }
  };

  const goHome = () => {
    if (activeSession) {
      abandonSession();
    }
    clearChild();
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          {/* Home button */}
          <button
            onClick={handleHomeClick}
            className="mr-1 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            aria-label="Home"
          >
            <Home className="w-5 h-5 text-gray-700" />
          </button>

          {(showBack || isNested) && (
            <button
              onClick={() => navigate(-1)}
              className="mr-2 p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
              aria-label="Terug"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {child && !isNested && (
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowChildPicker(!showChildPicker)}
                className="mr-2 flex items-center gap-1.5 touch-manipulation rounded-lg hover:bg-gray-100 px-1.5 py-1"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: child.avatarColor }}
                >
                  {child.name.charAt(0)}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {showChildPicker && allChildren && allChildren.length > 1 && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[160px] z-50">
                  {allChildren.map((c: Child) => (
                    <button
                      key={c.id}
                      onClick={() => handleSwitchChild(c.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                        c.id === selectedChildId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: c.avatarColor }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <span className={`text-sm font-medium ${c.id === selectedChildId ? 'text-blue-700' : 'text-gray-900'}`}>
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <h1 className="text-lg font-bold text-gray-900 truncate flex-1">{title}</h1>

          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={toggleTts}
              className={`p-2 rounded-lg hover:bg-gray-100 touch-manipulation ${ttsEnabled ? 'text-blue-500' : 'text-gray-300'}`}
              aria-label={ttsEnabled ? 'Voorlezen uit' : 'Voorlezen aan'}
              title={ttsEnabled ? 'Voorlezen uit' : 'Voorlezen aan'}
            >
              <Speech className="w-4 h-4" />
            </button>
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

      {showHomeConfirm && (
        <ConfirmDialog
          title="Terug naar Home?"
          description="Weet je zeker dat je wilt stoppen? Je voortgang van deze ronde gaat verloren."
          confirmLabel="Stoppen"
          onConfirm={() => {
            setShowHomeConfirm(false);
            goHome();
          }}
          onCancel={() => setShowHomeConfirm(false)}
        />
      )}
    </>
  );
}
