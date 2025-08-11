import { useState, type ReactElement } from 'react';
import { Filter } from 'lucide-react';
import { YearPickerInput } from '@mantine/dates';
import { PopUpModal } from '../../common/index.js';
import { Button } from '../../ui/button.js';

interface CorporateTaxRulingComplianceReportFilterProps {
  years: number[];
  setYears: (years: number[]) => void;
}

export function CorporateTaxRulingComplianceReportFilter({
  years,
  setYears,
}: CorporateTaxRulingComplianceReportFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        withCloseButton
        content={
          <YearPickerInput
            type="multiple"
            label="Pick years"
            value={years?.map(year => new Date(year, 0, 1))}
            onChange={date => setYears(date.map(date => date.getFullYear()))}
            popoverProps={{ withinPortal: true }}
            minDate={new Date(2010, 0, 1)}
            maxDate={new Date()}
          />
        }
      />
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
