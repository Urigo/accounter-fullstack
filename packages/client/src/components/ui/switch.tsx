import React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch inline-flex shrink-0 items-center rounded-full border border-gray-200 border-transparent shadow-xs transition-all outline-none focus-visible:border-gray-950 focus-visible:ring-[3px] focus-visible:ring-gray-950/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-200/80 dark:border-gray-800 dark:focus-visible:border-gray-300 dark:focus-visible:ring-gray-300/50 dark:data-[state=checked]:bg-gray-50 dark:data-[state=unchecked]:bg-gray-800 dark:dark:data-[state=unchecked]:bg-gray-800/80',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full bg-white ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-gray-50 dark:data-[state=unchecked]:bg-gray-950 dark:bg-gray-950 dark:dark:data-[state=checked]:bg-gray-900 dark:dark:data-[state=unchecked]:bg-gray-50',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
