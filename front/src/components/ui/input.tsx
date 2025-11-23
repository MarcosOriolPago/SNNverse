import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-gray-600 bg-gradient-to-br from-gray-800 to-gray-900 px-3.5 py-2 text-sm text-white placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 hover:border-gray-500',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
