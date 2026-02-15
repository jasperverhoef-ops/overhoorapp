import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      <div className="flex-1 pb-20 max-w-md mx-auto w-full">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
