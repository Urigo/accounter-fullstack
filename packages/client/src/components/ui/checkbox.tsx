import React from 'react';
import { CheckIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-[4px] border border-gray-200 shadow-xs transition-shadow outline-none focus-visible:border-gray-950 focus-visible:ring-[3px] focus-visible:ring-gray-950/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 data-[state=checked]:border-gray-900 data-[state=checked]:bg-gray-900 data-[state=checked]:text-gray-50 dark:bg-gray-200/30 dark:aria-invalid:ring-red-500/40 dark:data-[state=checked]:bg-gray-900 dark:border-gray-800 dark:focus-visible:border-gray-300 dark:focus-visible:ring-gray-300/50 dark:aria-invalid:border-red-900 dark:aria-invalid:ring-red-900/20 dark:data-[state=checked]:border-gray-50 dark:data-[state=checked]:bg-gray-50 dark:data-[state=checked]:text-gray-900 dark:dark:bg-gray-800/30 dark:dark:aria-invalid:ring-red-900/40 dark:dark:data-[state=checked]:bg-gray-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
