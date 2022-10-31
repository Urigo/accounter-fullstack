import gql from 'graphql-tag';

import { AllChargesVatFieldsFragment } from '../../../__generated__/types';

gql`
  fragment AllChargesVatFields on Charge {
    id
    vat {
      raw
      formatted
    }
  }
`;

type Props = {
  data: AllChargesVatFieldsFragment;
};

export const Vat = ({ data }: Props) => {
  const { vat } = data;

  return <div style={{ color: Number(vat?.raw) < 0 ? 'green' : 'red' }}>{vat?.formatted}</div>;
};
