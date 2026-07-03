import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import type { BusinessRowFilters } from './business-rows.js';

interface BusinessesFiltersProps {
  filters: BusinessRowFilters;
  setFilters: Dispatch<SetStateAction<BusinessRowFilters>>;
  /** True while the lazy usage query (which drives "Unused only") is in flight. */
  usageLoading?: boolean;
}

const FLAG_TOGGLES: { key: 'client' | 'admin' | 'inactive' | 'unusedOnly'; label: string }[] = [
  { key: 'client', label: 'Client' },
  { key: 'admin', label: 'Admin' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'unusedOnly', label: 'Unused only' },
];

export function BusinessesFilters({
  filters,
  setFilters,
  usageLoading = false,
}: BusinessesFiltersProps): ReactElement {
  const [inputName, setInputName] = useState(filters.name);
  const [inputSortCode, setInputSortCode] = useState(filters.sortCode);
  const [inputTaxCategory, setInputTaxCategory] = useState(filters.taxCategory);

  // debounce the free-text filters so typing doesn't re-filter the whole table on every keystroke
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(prev => ({ ...prev, name: inputName }));
    }, 600);
    return () => {
      clearTimeout(timeout);
    };
  }, [inputName, setFilters]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(prev => ({ ...prev, sortCode: inputSortCode }));
    }, 600);
    return () => {
      clearTimeout(timeout);
    };
  }, [inputSortCode, setFilters]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(prev => ({ ...prev, taxCategory: inputTaxCategory }));
    }, 600);
    return () => {
      clearTimeout(timeout);
    };
  }, [inputTaxCategory, setFilters]);

  return (
    <div className="flex flex-row gap-5 items-center">
      <Input
        className="w-72"
        placeholder="Business Name"
        value={inputName}
        onChange={event => setInputName(event.target.value)}
      />
      {FLAG_TOGGLES.map(toggle => {
        const showLoader = toggle.key === 'unusedOnly' && filters.unusedOnly && usageLoading;
        return (
          <Button
            key={toggle.key}
            size="sm"
            variant={filters[toggle.key] ? 'default' : 'outline'}
            onClick={() => setFilters(prev => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
          >
            {showLoader ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {toggle.label}
          </Button>
        );
      })}
      <Input
        className="w-24"
        placeholder="Sort code"
        value={inputSortCode}
        onChange={event => setInputSortCode(event.target.value)}
      />
      <Input
        className="w-40"
        placeholder="Tax category"
        value={inputTaxCategory}
        onChange={event => setInputTaxCategory(event.target.value)}
      />
    </div>
  );
}
