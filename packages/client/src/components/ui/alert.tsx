import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] [&>:not(svg)]:col-start-2 items-start gap-y-0.5 rounded-lg border border-gray-200 px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current dark:border-gray-800',
  {
    variants: {
      variant: {
        default: 'bg-white text-gray-950 dark:bg-gray-950 dark:text-gray-50',
        destructive:
          'bg-white text-red-500 *:data-[slot=alert-description]:text-red-500/90 [&>svg]:text-current dark:bg-gray-950 dark:text-red-900 dark:*:data-[slot=alert-description]:text-red-900/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 space-y-1 text-sm text-gray-500 [&_p]:leading-relaxed dark:text-gray-400',
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
