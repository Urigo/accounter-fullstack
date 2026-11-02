import { type ReactElement } from 'react';
import { Indicator } from '../../ui/indicator.js';

export type TaxCategoryProps = {
  taxCategory?: {
    id: string;
    name: string;
  };
  isMissing?: boolean;
};

export const TaxCategory = ({ taxCategory, isMissing }: TaxCategoryProps): ReactElement => {
  return (
    <Indicator inline size={12} disabled={!isMissing} color="red">
      <span className="wrap-anywhere">{taxCategory?.name ?? 'N/A'}</span>
    </Indicator>
  );
};
