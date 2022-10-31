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
    counterparty {
      name
    }
  }
`;

type Props = {
  data: AllChargesVatFieldsFragment;
  isBusiness: boolean;
};

export const Vat = ({ data, isBusiness }: Props) => {
  const { vat, totalAmount, counterparty } = data;

  const vatIssueFlag =
    (!vat &&
      isBusiness &&
      !businessesWithoutVAT.includes(counterparty?.name ?? '') &&
      !businessesWithoutTaxCategory.includes(counterparty?.name ?? '') &&
      totalAmount?.currency == Currency.Ils) ||
    ((vat?.raw ?? 0) > 0 && (totalAmount?.raw ?? 0) < 0) ||
    ((vat?.raw ?? 0) < 0 && (totalAmount?.raw ?? 0) > 0);

  return (
    <div style={{ color: vatIssueFlag ? 'red' : 'green' }}>{vat ? vat.formatted : vatIssueFlag ? 'Missing' : null}</div>
  );
};
