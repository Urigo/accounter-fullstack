import React, { type ComponentProps } from 'react';
import { ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import { ChevronLeftIcon, ChevronRightIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';

interface PaginationProps extends Omit<React.ComponentProps<'nav'>, 'onChange' | 'value'> {
  onChange: (page: number) => void;
  total: number;
  value: number;
}

const Pagination = ({ onChange, total, value, ...props }: PaginationProps) => {
  if (total <= 1) {
    return null;
  }
  const currentPage = value + 1;

  return (
    <PaginationWrapper {...props}>
      <PaginationContent>
        {/* previous button */}
        <PaginationItem>
          <PaginationPrevious disabled={currentPage <= 1} onClick={() => onChange(value - 1)} />
        </PaginationItem>

        {/* first page button */}
        {total > 3 && currentPage > 1 && (
          <PaginationItem>
            <PaginationLink onClick={() => onChange(0)}>1</PaginationLink>
          </PaginationItem>
        )}

        {total > 3 && currentPage > 3 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {currentPage > 2 && (
          <PaginationItem>
            <PaginationLink onClick={() => onChange(value - 1)}>{currentPage - 1}</PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem>
          <PaginationLink onClick={() => {}} isActive>
            {currentPage}
          </PaginationLink>
        </PaginationItem>
        {currentPage < total - 1 && (
          <PaginationItem>
            <PaginationLink onClick={() => onChange(value + 1)}>{currentPage + 1}</PaginationLink>
          </PaginationItem>
        )}

        {total > 3 && currentPage < total - 2 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {/* last page button */}
        {total > 3 && currentPage < total && (
          <PaginationItem>
            <PaginationLink onClick={() => onChange(total - 1)}>{total}</PaginationLink>
          </PaginationItem>
        )}
        {/* next button */}
        <PaginationItem>
          <PaginationNext disabled={currentPage >= total} onClick={() => onChange(value + 1)} />
        </PaginationItem>
      </PaginationContent>
    </PaginationWrapper>
  );
};
Pagination.displayName = 'Pagination';

const PaginationWrapper = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="paginationWrapper"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
PaginationWrapper.displayName = 'PaginationWrapper';

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
  ),
);
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn('', className)} {...props} />,
);
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & ComponentProps<typeof Button>;

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  children,
  ...props
}: PaginationLinkProps) => (
  <Button
    aria-current={isActive ? 'page' : undefined}
    variant={isActive ? 'outline' : 'ghost'}
    size={size}
    className={className}
    {...props}
  >
    {children}
  </Button>
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronLeftIcon className="h-4 w-4" />
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationFirst = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to First page"
    size="default"
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronsLeftIcon className="h-4 w-4" />
  </PaginationLink>
);
PaginationFirst.displayName = 'PaginationFirst';

const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <ChevronRightIcon className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationLast = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to Last page"
    size="default"
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <ChevronsRightIcon className="h-4 w-4" />
  </PaginationLink>
);
PaginationLast.displayName = 'PaginationLast';

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <DotsHorizontalIcon className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
