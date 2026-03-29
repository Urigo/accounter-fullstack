import { useMemo, type ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';

export type VatProps = {
  value?: number;
  currency?: Currency;
  missingInfo?: boolean;
  amountValue?: number;
};

export const Vat = ({ value, currency, amountValue, missingInfo }: VatProps): ReactElement => {
  const isLocalCurrencyButNoVat = useMemo(
    () => !value && currency === Currency.Ils,
    [value, currency],
  );
  const vatIsNegativeToAmount = useMemo(
    () =>
      ((value ?? 0) > 0 && (amountValue ?? 0) < 0) || ((value ?? 0) < 0 && (amountValue ?? 0) > 0),
    [value, amountValue],
  );
  const isError = isLocalCurrencyButNoVat || vatIsNegativeToAmount;

  return (
    <div
      className={isError ? 'whitespace-nowrap text-red-500' : 'whitespace-nowrap text-green-700'}
    >
      <Indicator inline size={12} disabled={!missingInfo} color="red" zIndex="auto">
        {value != null && currency ? formatAmountWithCurrency(value, currency) : null}
      </Indicator>
    </div>
  );
};
