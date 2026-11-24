import { type ReactElement } from 'react';
import { Indicator } from '../../ui/indicator.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableTaxCategoryFields on Charge {
    id
    taxCategory {
      id
      name
    }
    validationData {
      missingInfo
    }
  }
`;

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
      {taxCategory?.name ?? 'N/A'}
    </Indicator>
  );
};
