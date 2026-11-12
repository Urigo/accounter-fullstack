import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils.js';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-gray-200 border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-gray-950 focus-visible:ring-[3px] focus-visible:ring-gray-950/50 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 [&>svg]:pointer-events-none [&>svg]:size-3 dark:border-gray-800 dark:focus-visible:border-gray-300 dark:focus-visible:ring-gray-300/50 dark:aria-invalid:border-red-900 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40',
  {
    variants: {
      variant: {
        default:
          'bg-gray-900 text-gray-50 [a&]:hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:[a&]:hover:bg-gray-50/90',
        secondary:
          'bg-gray-100 text-gray-900 [a&]:hover:bg-gray-100/90 dark:bg-gray-800 dark:text-gray-50 dark:[a&]:hover:bg-gray-800/90',
        destructive:
          'bg-red-500 text-white focus-visible:ring-red-500/20 dark:bg-red-500/60 dark:focus-visible:ring-red-500/40 [a&]:hover:bg-red-500/90 dark:bg-red-900 dark:focus-visible:ring-red-900/20 dark:dark:bg-red-900/60 dark:dark:focus-visible:ring-red-900/40 dark:[a&]:hover:bg-red-900/90',
        outline:
          'border-gray-200 text-gray-950 [a&]:hover:bg-gray-100 [a&]:hover:text-gray-900 dark:border-gray-800 dark:text-gray-50 dark:[a&]:hover:bg-gray-800 dark:[a&]:hover:text-gray-50',
        ghost:
          '[a&]:hover:bg-gray-100 [a&]:hover:text-gray-900 dark:[a&]:hover:bg-gray-800 dark:[a&]:hover:text-gray-50',
        link: 'text-gray-900 underline-offset-4 [a&]:hover:underline dark:text-gray-50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
