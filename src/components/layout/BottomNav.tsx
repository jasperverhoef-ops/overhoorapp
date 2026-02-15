import { NavLink } from 'react-router-dom';
import { BookOpen, Play, BarChart3 } from 'lucide-react';

const tabs = [
  { to: '/lists', label: 'Lijsten', icon: BookOpen },
  { to: '/play', label: 'Spelen', icon: Play },
  { to: '/stats', label: 'Statistieken', icon: BarChart3 },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors touch-manipulation ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
