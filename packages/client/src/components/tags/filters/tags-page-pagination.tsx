import { ReactElement, useEffect } from 'react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '../../ui/pagination';
import { Button } from '../../ui/button';
import { Loader2 } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    onPageChange: (page: number) => void;
    totalPages: number;
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    fetching: boolean;
}

export function AllTagsPagePagination({ fetching, currentPage, onPageChange, totalPages, get, set }: PaginationProps): ReactElement {

    useEffect(() => {
        const newPage = currentPage > 1 ? currentPage.toString() : '1';
        const oldPage = get('page');
        if (newPage !== oldPage) {
            set('page', newPage);
        }
    }, [currentPage, get, set]);

    const previousIsActive = currentPage > 1;
    const nextIsIsActive = currentPage < totalPages;

    return (
        fetching ? (
            <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
        ) : (
            <Pagination>
                <Button
                    variant='outline'
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={!previousIsActive}
                >
                    Previous
                </Button>
                <PaginationContent>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem
                            key={page}
                            onClick={() => onPageChange(page)}
                        >
                            <PaginationLink>{page}</PaginationLink>
                        </PaginationItem>
                    ))}
                </PaginationContent>
                <Button
                    variant='outline'
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={!nextIsIsActive}
                >
                    Next
                </Button>
            </Pagination>
        )
    )
}
