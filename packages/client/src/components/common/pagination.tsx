import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Pagination as PaginationWrapper,
} from '@/components/ui/pagination.js';

const usePagination = (totalPages: number, pageIndex: number): Array<'...' | number> => {
  const maxPageIndex = totalPages - 1;
  if (maxPageIndex <= 0) {
    return [];
  }

  const pages: Array<'...' | number> = [];
  pages.push(0);
  if (pageIndex > 2) {
    pages.push('...');
  }
  if (pageIndex > 1) {
    pages.push(pageIndex - 1);
  }
  if (pageIndex > 0 && pageIndex < maxPageIndex) {
    pages.push(pageIndex);
  }
  if (pageIndex < maxPageIndex - 1) {
    pages.push(pageIndex + 1);
  }
  if (pageIndex < maxPageIndex - 2) {
    pages.push('...');
  }
  pages.push(maxPageIndex);
  return pages;
};

interface PaginationProps extends Omit<React.ComponentProps<'nav'>, 'onChange' | 'value'> {
  onChange: (page: number) => void;
  totalPages: number;
  currentPage: number;
}

export const Pagination = ({ onChange, totalPages, currentPage, ...props }: PaginationProps) => {
  const pages = usePagination(totalPages, currentPage);

  if (!pages.length) {
    return null;
  }

  return (
    <PaginationWrapper {...props}>
      <PaginationContent>
        {/* previous button */}
        <PaginationItem>
          <PaginationPrevious
            disabled={currentPage < 1}
            onClick={() => onChange(currentPage - 1)}
          />
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
              <PaginationLink onClick={() => onChange(page)} isActive={isActive}>
                {page + 1}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        {/* next button */}
        <PaginationItem>
          <PaginationNext
            disabled={currentPage >= totalPages - 1}
            onClick={() => onChange(currentPage + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </PaginationWrapper>
  );
};
Pagination.displayName = 'Pagination';
