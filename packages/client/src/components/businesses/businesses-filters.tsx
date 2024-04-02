import { Dispatch, ReactElement, SetStateAction, useEffect } from 'react';
import { Pagination, TextInput } from '@mantine/core';
import { useUrlQuery } from '../../hooks/use-url-query.js';

interface ChargesFiltersProps {
  activePage: number;
  totalPages?: number;
  setPage: Dispatch<SetStateAction<number>>;
  businessName?: string;
  setBusinessName: Dispatch<SetStateAction<string | undefined>>;
}

export function BusinessesFilters({
  activePage,
  setPage,
  totalPages = 1,
  businessName,
  setBusinessName,
}: ChargesFiltersProps): ReactElement {
  const { get, set } = useUrlQuery();

  // update url on page change
  useEffect(() => {
    const newPage = activePage > 1 ? activePage.toFixed(0) : undefined;
    const oldPage = get('page');
    if (newPage !== oldPage && newPage !== '1') {
      set('page', newPage);
    }
  }, [activePage, get, set]);

  return (
    <div className="flex flex-row gap-5 items-center">
      <Pagination className="flex-auto" value={activePage} onChange={setPage} total={totalPages} />
      <TextInput
        placeholder="Business Name"
        defaultValue={businessName ?? undefined}
        onChange={event =>
          setBusinessName(event.target.value === '' ? undefined : event.target.value)
        }
      />
    </div>
  );
}
