import { type ReactElement } from 'react';

type Props = {
  taxCategory: {
    id?: string;
    name?: string;
  };
};

export const TaxCategory = ({ taxCategory }: Props): ReactElement => {
  return <p className="text-sm font-medium">{taxCategory?.name}</p>;
};
