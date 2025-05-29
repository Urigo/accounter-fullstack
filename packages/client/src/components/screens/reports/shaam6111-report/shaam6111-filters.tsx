import { useMemo, useState } from 'react';
import { Building2, Calendar, Filter } from 'lucide-react';
import { useGetBusinesses } from '../../../../hooks/use-get-businesses.js';
import { ComboBox } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../ui/dialog.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';

type Shaam6111FiltersProps = {
  selectedBusiness?: string;
  setSelectedBusiness: (business?: string) => void;
  selectedYear?: string;
  setSelectedYear: (year: string) => void;
  referenceYear?: string;
  setReferenceYear: (year?: string) => void;
};

const availableYears = ['2020', '2021', '2022', '2023']; // TODO: replace with business-specific years

export function Shaam6111Filters({
  selectedBusiness,
  setSelectedBusiness,
  selectedYear,
  setSelectedYear,
  referenceYear,
  setReferenceYear,
}: Shaam6111FiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(!selectedYear || !selectedBusiness);
  const { selectableBusinesses: businesses, fetching: businessesLoading } = useGetBusinesses();

  const businessName = useMemo(() => {
    if (!selectedBusiness) return '';
    const business = businesses.find(b => b.value === selectedBusiness);
    return business?.label ?? '';
  }, [businesses, selectedBusiness]);

  return (
    <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          מסננים
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
            {businessName} • {selectedYear}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            מסנני דוח
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="business-select" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              בחירת עסק
            </Label>
            <ComboBox
              onChange={value => setSelectedBusiness(value ?? undefined)}
              data={businesses}
              value={selectedBusiness}
              disabled={businessesLoading}
              placeholder="Scroll to see all options"
              triggerProps={{ className: 'w-full' }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="year-select" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              שנת דיווח
            </Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">זמינות נתונים: {availableYears.join(', ')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year-select" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              שנת השוואה
            </Label>
            <Select
              value={referenceYear}
              onValueChange={value => setReferenceYear(value === 'none' ? undefined : value)}
            >
              <SelectTrigger id="year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="none" value="none">
                  ללא
                </SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">זמינות נתונים: {availableYears.join(', ')}</p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setFiltersOpen(false)}>
              ביטול
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>אישור</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
