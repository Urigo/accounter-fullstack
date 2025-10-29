import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Pagination as PaginationWrapper,
} from '@/components/ui/pagination.js';

const usePagination = (totalPages: number, currentPage: number): Array<'...' | number> => {
  if (totalPages <= 1) {
    return [];
  }

  const pages: Array<'...' | number> = [];
  pages.push(1);
  if (currentPage > 3) {
    pages.push('...');
  }
  if (currentPage > 2) {
    pages.push(currentPage - 1);
  }
  if (currentPage !== 1 && currentPage !== totalPages) {
    pages.push(currentPage);
  }
  if (currentPage < totalPages - 1) {
    pages.push(currentPage + 1);
  }
  if (currentPage < totalPages - 2) {
    pages.push('...');
  }
  pages.push(totalPages);
  return pages;
};

interface PaginationProps extends Omit<React.ComponentProps<'nav'>, 'onChange' | 'value'> {
  onChange: (page: number) => void;
  total: number;
  value: number;
}

export const Pagination = ({ onChange, total, value, ...props }: PaginationProps) => {
  const currentPage = value + 1;
  const pages = usePagination(total, currentPage);

  if (!pages.length) {
    return null;
  }

  return (
    <PaginationWrapper {...props}>
      <PaginationContent>
        {/* previous button */}
        <PaginationItem>
          <PaginationPrevious disabled={currentPage <= 1} onClick={() => onChange(value - 1)} />
        </PaginationItem>
        {/* page numbers */}
        {pages.map((page, index) => {
          if (page === '...') {
            return (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }
          const isActive = page === currentPage;
          return (
            <PaginationItem key={`page-${page}`}>
              <PaginationLink onClick={() => onChange(page - 1)} isActive={isActive}>
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        {/* next button */}
        <PaginationItem>
          <PaginationNext disabled={currentPage >= total} onClick={() => onChange(value + 1)} />
        </PaginationItem>
      </PaginationContent>
    </PaginationWrapper>
  );
};
Pagination.displayName = 'Pagination';
