import React from 'react';
import { cn } from '@/lib/utils.js';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-gray-950 placeholder:text-gray-500 selection:bg-gray-900 selection:text-gray-50 dark:bg-gray-200/30 border-gray-200 flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:file:text-gray-50 dark:placeholder:text-gray-400 dark:selection:bg-gray-50 dark:selection:text-gray-900 dark:dark:bg-gray-800/30 dark:border-gray-800',
        'focus-visible:border-gray-950 focus-visible:ring-gray-950/50 focus-visible:ring-[3px] dark:focus-visible:border-gray-300 dark:focus-visible:ring-gray-300/50',
        'aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
