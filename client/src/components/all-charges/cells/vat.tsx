import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesVatFieldsFragmentDoc, Currency } from '../../../gql/graphql';
import { businessesWithoutTaxCategory, businessesWithoutVAT } from '../../../helpers';

/* GraphQL */ `
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
    financialEntity {
      __typename
      id
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesVatFieldsFragmentDoc>;
};

export const Vat = ({ data }: Props) => {
  const { vat, totalAmount, counterparty, financialEntity } = getFragmentData(
    AllChargesVatFieldsFragmentDoc,
    data,
  );
  const isBusiness = financialEntity?.__typename === 'LtdFinancialEntity';

  const vatIssueFlag =
    (!vat &&
      isBusiness &&
      !businessesWithoutVAT.includes(counterparty?.name ?? '') &&
      !businessesWithoutTaxCategory.includes(counterparty?.name ?? '') &&
      totalAmount?.currency == Currency.Ils) ||
    ((vat?.raw ?? 0) > 0 && (totalAmount?.raw ?? 0) < 0) ||
    ((vat?.raw ?? 0) < 0 && (totalAmount?.raw ?? 0) > 0);

  return (
    <div style={{ color: vatIssueFlag ? 'red' : 'green' }}>
      {vat ? vat.formatted : vatIssueFlag ? 'Missing' : null}
    </div>
  );
};
