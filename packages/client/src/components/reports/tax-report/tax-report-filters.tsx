import { useState, type ReactElement } from 'react';
import { Filter } from 'lucide-react';
import { PopUpModal } from '../../common/index.js';
import { YearPickerInput } from '../../common/inputs/year-picker-input.js';
import { Button } from '../../ui/button.js';

interface TaxReportFilterProps {
  year: number;
  setYear: (year: number) => void;
  referenceYears: number[];
  setReferenceYears: (years: number[]) => void;
}

export function TaxReportFilter({
  year,
  setYear,
  referenceYears,
  setReferenceYears,
}: TaxReportFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <PopUpModal opened={opened} onClose={(): void => setOpened(false)} withCloseButton>
        <>
          <YearPickerInput
            label="Change report year"
            value={new Date(year, 0, 1)}
            onChange={date => date && setYear(date?.getFullYear())}
            minDate={new Date(2010, 0, 1)}
            maxDate={new Date()}
          />
          <YearPickerInput
            type="multiple"
            label="Pick reference years"
            value={referenceYears?.map(year => new Date(year, 0, 1))}
            onChange={date =>
              setReferenceYears(
                date.map(date => date.getFullYear()).filter(refYear => year !== refYear),
              )
            }
            minDate={new Date(2010, 0, 1)}
            maxDate={new Date()}
          />
        </>
      </PopUpModal>
      <Button
        variant="outline"
        size="icon"
        className="size-7.5"
        onClick={(): void => setOpened(true)}
      >
        <Filter className="size-5" />
      </Button>
    </>
  );
}
