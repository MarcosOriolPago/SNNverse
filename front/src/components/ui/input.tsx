import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-[2.75rem] w-full rounded-lg border-[1.5px] border-slate-500/40 bg-gradient-bg-glass px-lg py-[0.625rem] text-md font-medium text-text-primary shadow-inset-sm transition-all duration-300 ease-smooth box-border',
        'placeholder:text-slate-500 placeholder:font-normal',
        'hover:border-purple-500/50 hover:bg-[linear-gradient(135deg,rgba(30,41,59,0.7)0%,rgba(15,23,42,0.9)100%)]',
        'focus:outline-none focus:border-primary focus:shadow-inset-md focus:bg-[linear-gradient(135deg,rgba(30,41,59,0.8)0%,rgba(15,23,42,1)100%)]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/50',
        // Number input styling to hide spinners
        type === 'number' && '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
