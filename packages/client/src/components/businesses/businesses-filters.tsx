import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { Pagination } from '../common/index.js';
import { Input } from '../ui/input.js';

interface BusinessesFiltersProps {
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
}: BusinessesFiltersProps): ReactElement {
  const { get, set } = useUrlQuery();
  const [inputBusinessName, setInputBusinessName] = useState(businessName);

  // update url on page change
  useEffect(() => {
    const newPage = activePage > 1 ? activePage.toFixed(0) : undefined;
    const oldPage = get('page');
    if (newPage !== oldPage && newPage !== '1') {
      set('page', newPage);
    }
  }, [activePage, get, set]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setBusinessName(inputBusinessName);
    }, 600);
    return () => {
      clearTimeout(timeout);
    };
  }, [inputBusinessName, setBusinessName]);

  const onInputBusinessNameChange = (input?: string) => {
    setInputBusinessName(input);
  };

  return (
    <div className="flex flex-row gap-5 items-center">
      <Pagination
        className="flex-fit w-fit mx-0"
        currentPage={activePage}
        onChange={setPage}
        total={totalPages}
      />
      <Input
        className="w-72"
        placeholder="Business Name"
        defaultValue={businessName ?? undefined}
        onChange={event =>
          onInputBusinessNameChange(event.target.value === '' ? undefined : event.target.value)
        }
      />
    </div>
  );
}
