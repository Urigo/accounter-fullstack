import { ReactElement, useState } from 'react';
import { Filter } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { YearPickerInput } from '@mantine/dates';
import { PopUpModal } from '../../common/index.js';

interface TaxReportFilterProps {
  years: number[];
  setYears: (years: number[]) => void;
}

export function TaxReportFilter({ years, setYears }: TaxReportFilterProps): ReactElement {
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
      <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
        <Filter size={20} />
      </ActionIcon>
    </>
  );
}
