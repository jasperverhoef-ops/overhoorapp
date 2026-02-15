import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${onClick ? 'cursor-pointer hover:shadow-md active:bg-gray-50 transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
