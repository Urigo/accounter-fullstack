import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesVatFieldsFragmentDoc, Currency, MissingChargeInfo } from '../../../gql/graphql';
import { businessesWithoutTaxCategory, entitiesWithoutInvoice } from '../../../helpers';

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
    validationData {
      missingInfo
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesVatFieldsFragmentDoc>;
};

export const Vat = ({ data }: Props) => {
  const { vat, totalAmount, counterparty, financialEntity, validationData } = getFragmentData(
    AllChargesVatFieldsFragmentDoc,
    data,
  );
  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Vat);
  const isBusiness = financialEntity?.__typename === 'LtdFinancialEntity';

  const vatIssueFlag =
    (!vat &&
      isBusiness &&
      !entitiesWithoutInvoice.includes(counterparty?.name ?? '') &&
      !businessesWithoutTaxCategory.includes(counterparty?.name ?? '') &&
      totalAmount?.currency == Currency.Ils) ||
    ((vat?.raw ?? 0) > 0 && (totalAmount?.raw ?? 0) < 0) ||
    ((vat?.raw ?? 0) < 0 && (totalAmount?.raw ?? 0) > 0);

  return (
    <td>
      <div style={{ color: vatIssueFlag ? 'red' : 'green' }}>
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          {vat ? vat.formatted : vatIssueFlag ? 'Missing' : null}
        </Indicator>
      </div>
    </td>
  );
};
