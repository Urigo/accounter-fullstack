import { Skeleton } from '@/components/ui/skeleton.js';

interface TableSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns to display. Default: 5 */
  columns?: number;
  /** Number of rows to display. Default: 5 */
  rows?: number;
  /** Height of header cells in Tailwind classes. Default: 'h-10' */
  headerHeight?: string;
  /** Height of row cells in Tailwind classes. Default: 'h-8' */
  rowHeight?: string;
  /** Whether to show the header row. Default: true */
  showHeader?: boolean;
  /** Custom column widths array (e.g., ['flex-1', 'w-20', 'flex-2']). If not provided, all columns will be 'flex-1' */
  columnWidths?: string[];
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
  headerHeight = 'h-10',
  rowHeight = 'h-8',
  showHeader = true,
  columnWidths,
  ...props
}: TableSkeletonProps) {
  // Generate default column widths if not provided
  const widths = columnWidths || Array(columns).fill('flex-1');

  return (
    <div className="space-y-2" {...props}>
      {/* Table Header Skeleton */}
      {showHeader && (
        <div className="flex gap-2 border-b pb-2">
          {widths.map((width, i) => (
            <Skeleton key={i} className={`${headerHeight} ${width}`} />
          ))}
        </div>
      )}
      {/* Table Rows Skeleton */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-2 border-b py-2">
          {widths.map((width, j) => (
            <Skeleton key={j} className={`${rowHeight} ${width}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
