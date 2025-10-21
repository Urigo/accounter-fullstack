import type { ReactElement } from 'react';
import { Skeleton } from '../ui/skeleton.js';

/**
 * Generic page loading skeleton
 * Displayed during route transitions
 */
export function PageSkeleton(): ReactElement {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-12 w-64" /> {/* Page title */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-32" /> {/* Button/filter */}
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-96 w-full" /> {/* Main content area */}
    </div>
  );
}

/**
 * Table loading skeleton
 */
export function TableSkeleton(): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-12 w-full" /> {/* Header */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/**
 * Report loading skeleton
 */
export function ReportSkeleton(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-16 w-96" /> {/* Report title */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-48" /> {/* Date filter */}
        <Skeleton className="h-10 w-32" /> {/* Export button */}
      </div>
      <Skeleton className="h-[600px] w-full" /> {/* Report content */}
    </div>
  );
}
