import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'good' | 'wrong' | 'hint' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
  good: 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700',
  wrong: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
  hint: 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-base rounded-xl',
  lg: 'px-6 py-3.5 text-lg rounded-xl',
  xl: 'px-8 py-5 text-xl rounded-2xl min-h-[64px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`font-semibold transition-colors duration-100 select-none touch-manipulation ${variants[variant]} ${sizes[size]} ${className} disabled:opacity-50 disabled:pointer-events-none`}
      {...props}
    >
      {children}
    </button>
  );
}
