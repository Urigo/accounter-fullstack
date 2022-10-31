import gql from 'graphql-tag';

import { AllChargesVatFieldsFragment, Currency } from '../../../__generated__/types';
import { businessesWithoutTaxCategory, businessesWithoutVAT } from '../../../helpers';

gql`
  fragment AllChargesVatFields on Charge {
    id
    vat {
      raw
      formatted
    }
    totalAmount {
      raw
      currency
    }
  }
`;

type Props = {
  data: AllChargesVatFieldsFragment;
  isBusiness: boolean;
  financialEntity?: string;
};

export const Vat = ({ data, isBusiness, financialEntity = '' }: Props) => {
  const { vat, totalAmount } = data;

  const vatIssueFlag =
    (!vat &&
      isBusiness &&
      !businessesWithoutVAT.includes(financialEntity) &&
      !businessesWithoutTaxCategory.includes(financialEntity) &&
      totalAmount?.currency == Currency.Ils) ||
    ((vat?.raw ?? 0) > 0 && (totalAmount?.raw ?? 0) < 0) ||
    ((vat?.raw ?? 0) < 0 && (totalAmount?.raw ?? 0) > 0);

  return (
    <div style={{ color: vatIssueFlag ? 'red' : 'green' }}>{vat ? vat.formatted : vatIssueFlag ? 'Missing' : null}</div>
  );
};
