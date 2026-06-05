import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const Button = ({ children, className, variant = 'primary', size = 'default', ...props }) => {
    const variants = {
        primary: 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-lg shadow-violet-200/60',
        secondary: 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200 shadow-sm',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        ghost: 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-900',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        default: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    return (
        <button 
            className={cn("inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-200 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none", variants[variant], sizes[size], className)}
            {...props}
        >
            {children}
        </button>
    );
};

export const Card = ({ children, className }) => (
    <div className={cn("bg-white/80 rounded-2xl border border-white/70 shadow-[0_16px_40px_-28px_rgba(91,76,170,0.5)] overflow-hidden backdrop-blur relative", className)}>
        {children}
    </div>
);

export const Input = React.forwardRef(({ className, ...props }, ref) => (
    <input
        ref={ref}
        className={cn("flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 disabled:cursor-not-allowed disabled:opacity-50 transition-colors", className)}
        {...props}
    />
));
Input.displayName = "Input";
