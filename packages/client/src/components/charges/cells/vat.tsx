import { type ReactElement } from 'react';
import { Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';
import { Indicator } from '../../ui/indicator.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableVatFields on Charge {
    id
    vat {
      raw
    }
    totalAmount {
      raw
      currency
    }
    validationData {
      missingInfo
    }
  }
`;

export type VatProps = {
  value?: number;
  currency?: Currency;
  missingInfo?: boolean;
  amountValue?: number;
};

export const Vat = ({ value, currency, amountValue, missingInfo }: VatProps): ReactElement => {
  const isLocalCurrencyButNoVat = value == null && currency === Currency.Ils;
  const vatIsNegativeToAmount =
    ((value ?? 0) > 0 && (amountValue ?? 0) < 0) || ((value ?? 0) < 0 && (amountValue ?? 0) > 0);
  const isError = isLocalCurrencyButNoVat || vatIsNegativeToAmount;

  return (
    <div
      className={isError ? 'whitespace-nowrap text-red-500' : 'whitespace-nowrap text-green-700'}
    >
      <Indicator inline size={12} disabled={!missingInfo} color="red">
        {value != null && currency ? formatAmountWithCurrency(value, currency) : null}
      </Indicator>
    </div>
  );
};
