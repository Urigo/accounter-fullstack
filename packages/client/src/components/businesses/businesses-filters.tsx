import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { Pagination } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import type { BusinessRowFilters } from './business-rows.js';

interface BusinessesFiltersProps {
  activePage: number;
  totalPages?: number;
  setPage: Dispatch<SetStateAction<number>>;
  businessName?: string;
  setBusinessName: Dispatch<SetStateAction<string | undefined>>;
  filters: BusinessRowFilters;
  setFilters: Dispatch<SetStateAction<BusinessRowFilters>>;
}

const FLAG_TOGGLES: { key: 'client' | 'admin' | 'inactive' | 'unusedOnly'; label: string }[] = [
  { key: 'client', label: 'Client' },
  { key: 'admin', label: 'Admin' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'unusedOnly', label: 'Unused only' },
];

export function BusinessesFilters({
  activePage,
  setPage,
  totalPages = 1,
  businessName,
  setBusinessName,
  filters,
  setFilters,
}: BusinessesFiltersProps): ReactElement {
  const { get, set } = useUrlQuery();
  const [inputBusinessName, setInputBusinessName] = useState(businessName);

  // update url on page change
  useEffect(() => {
    const newPage = activePage > 0 ? activePage.toFixed(0) : undefined;
    const oldPage = get('page');
    if (newPage !== oldPage && newPage !== '0') {
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
        currentPageIndex={activePage}
        onChange={setPage}
        totalPages={totalPages}
      />
      <Input
        className="w-72"
        placeholder="Business Name"
        defaultValue={businessName ?? undefined}
        onChange={event =>
          onInputBusinessNameChange(event.target.value === '' ? undefined : event.target.value)
        }
      />
      {FLAG_TOGGLES.map(toggle => (
        <Button
          key={toggle.key}
          size="sm"
          variant={filters[toggle.key] ? 'default' : 'outline'}
          onClick={() => setFilters(prev => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
        >
          {toggle.label}
        </Button>
      ))}
      <Input
        className="w-24"
        placeholder="Sort code"
        value={filters.sortCode}
        onChange={event => setFilters(prev => ({ ...prev, sortCode: event.target.value }))}
      />
      <Input
        className="w-40"
        placeholder="Tax category"
        value={filters.taxCategory}
        onChange={event => setFilters(prev => ({ ...prev, taxCategory: event.target.value }))}
      />
    </div>
  );
}
