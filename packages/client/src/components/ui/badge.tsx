import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';
import { Slot } from '@radix-ui/react-slot';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-gray-950 focus-visible:ring-gray-950/50 focus-visible:ring-[3px] aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 transition-[color,box-shadow] overflow-hidden dark:border-gray-800 dark:focus-visible:border-gray-300 dark:focus-visible:ring-gray-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gray-900 text-gray-50 [a&]:hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:[a&]:hover:bg-gray-50/90',
        secondary:
          'border-transparent bg-gray-100 text-gray-900 [a&]:hover:bg-gray-100/90 dark:bg-gray-800 dark:text-gray-50 dark:[a&]:hover:bg-gray-800/90',
        destructive:
          'border-transparent bg-red-500 text-white [a&]:hover:bg-red-500/90 focus-visible:ring-red-500/20 dark:focus-visible:ring-red-500/40 dark:bg-red-500/60 dark:bg-red-900 dark:[a&]:hover:bg-red-900/90 dark:focus-visible:ring-red-900/20 dark:dark:focus-visible:ring-red-900/40 dark:dark:bg-red-900/60',
        outline:
          'text-gray-950 [a&]:hover:bg-gray-100 [a&]:hover:text-gray-900 dark:text-gray-50 dark:[a&]:hover:bg-gray-800 dark:[a&]:hover:text-gray-50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
