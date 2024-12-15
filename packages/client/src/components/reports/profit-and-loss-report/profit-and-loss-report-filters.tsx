import { ReactElement, useState } from 'react';
import { Filter } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { YearPickerInput } from '@mantine/dates';
import { PopUpModal } from '../../common/index.js';

interface ProfitAndLossReportFilterProps {
  year: number;
  setYear: (year: number) => void;
  referenceYears: number[];
  setReferenceYears: (years: number[]) => void;
}

export function ProfitAndLossReportFilter({
  year,
  setYear,
  referenceYears,
  setReferenceYears,
}: ProfitAndLossReportFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        withCloseButton
        content={
          <>
            <YearPickerInput
              label="Change report year"
              value={new Date(year, 0, 1)}
              onChange={date => date && setYear(date?.getFullYear())}
              popoverProps={{ withinPortal: true }}
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
              popoverProps={{ withinPortal: true }}
              minDate={new Date(2010, 0, 1)}
              maxDate={new Date()}
            />
          </>
        }
      />
      <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
        <Filter size={20} />
      </ActionIcon>
    </>
  );
}
