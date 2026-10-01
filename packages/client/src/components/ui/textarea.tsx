import React from 'react';
import { cn } from '@/lib/utils.js';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-gray-500 focus-visible:border-gray-950 focus-visible:ring-[3px] focus-visible:ring-gray-950/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 md:text-sm dark:bg-gray-200/30 dark:aria-invalid:ring-red-500/40 dark:border-gray-800 dark:placeholder:text-gray-400 dark:focus-visible:border-gray-300 dark:focus-visible:ring-gray-300/50 dark:aria-invalid:border-red-900 dark:aria-invalid:ring-red-900/20 dark:dark:bg-gray-800/30 dark:dark:aria-invalid:ring-red-900/40',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
