import { type ReactElement } from 'react';
import { Indicator } from '@mantine/core';

export type TaxCategoryProps = {
  taxCategory?: {
    id: string;
    name: string;
  };
  isMissing?: boolean;
};

export const TaxCategory = ({ taxCategory, isMissing }: TaxCategoryProps): ReactElement => {
  return (
    <Indicator inline size={12} disabled={!isMissing} color="red" zIndex="auto">
      {taxCategory?.name ?? 'N/A'}
    </Indicator>
  );
};
