import { Dispatch, ReactElement, SetStateAction, useEffect } from 'react';
import { Pagination } from '@mantine/core';
import { useUrlQuery } from '../../hooks/use-url-query.js';

interface ChargesFiltersProps {
  activePage: number;
  totalPages?: number;
  setPage: Dispatch<SetStateAction<number>>;
}

export function BusinessesFilters({
  activePage,
  setPage,
  totalPages = 1,
}: ChargesFiltersProps): ReactElement {
  const { get, set } = useUrlQuery();

  // update url on page change
  useEffect(() => {
    const newPage = activePage > 1 ? activePage.toFixed(0) : null;
    const oldPage = get('page');
    if (newPage !== oldPage && newPage !== '1') {
      set('page', newPage);
    }
  }, [activePage, get, set]);

  return (
    <div className="flex flex-row gap-5 items-center">
      {/* {totalPages > 1 && ( */}
        <Pagination
          className="flex-auto"
          value={activePage}
          onChange={setPage}
          total={totalPages}
        />
      {/* )} */}
    </div>
  );
}
