import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function Header({ title, showBack, right }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isNested = location.pathname.split('/').filter(Boolean).length > 1;

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
        <h1 className="text-lg font-bold text-gray-900 truncate flex-1">{title}</h1>
        {right && <div className="ml-2">{right}</div>}
      </div>
    </header>
  );
}
