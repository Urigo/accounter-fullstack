import { cn } from '@/lib/utils.js';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-gray-100 dark:bg-gray-800', className)}
      {...props}
    />
  );
}

export { Skeleton };
