import { ReactElement, useEffect } from 'react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../ui/pagination';
import { useUrlQuery } from '../../hooks/use-url-query';

interface PaginationProps {
    currentPage: number;
    onPageChange: (page: number) => void;
    totalPages: number;
}

export function AllTagsPagePagination({ currentPage, onPageChange, totalPages }: PaginationProps): ReactElement {
    const { get, set } = useUrlQuery();

    useEffect(() => {
        const newPage = currentPage > 1 ? currentPage.toString() : '1';
        const oldPage = get('page');
        if (newPage !== oldPage) {
            set('page', newPage);

        }
    }, [currentPage, get, set]);

    return (
        <Pagination>
            <PaginationPrevious
                onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                isActive={currentPage === 1}
            >
                Previous
            </PaginationPrevious>
            <PaginationContent>
                {Array.from({ length: totalPages }, (_, index) => (
                    <PaginationItem key={index}>
                        <PaginationLink
                            href={`?page=${index + 1}`}
                            isActive={index + 1 === currentPage}
                            onClick={(e) => {
                                e.preventDefault();
                                onPageChange(index + 1);
                            }}
                        >
                            {index + 1}
                        </PaginationLink>
                    </PaginationItem>
                ))}
            </PaginationContent>
            <PaginationNext
                onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                isActive={currentPage === totalPages}
            >
                Next
            </PaginationNext>
        </Pagination>
    );
}
