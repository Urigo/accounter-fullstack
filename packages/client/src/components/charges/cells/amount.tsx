import { type ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { Currency } from '../../../gql/graphql.js';
import { formatAmountWithCurrency } from '../../../helpers/index.js';

export type AmountProps = {
  amount?: {
    value: number;
    currency: Currency;
    shouldValidate: boolean;
    isValid?: boolean;
  };
};

export const Amount = ({ amount }: AmountProps): ReactElement | null => {
  if (!amount) {
    return null;
  }
  const { value, currency, shouldValidate, isValid } = amount;
  return (
    <Indicator
      inline
      size={12}
      disabled={isValid === undefined ? true : isValid}
      processing={shouldValidate && isValid === undefined}
      color="red"
      zIndex="auto"
    >
      <p
        className={
          (value ?? 0) > 0 ? 'whitespace-nowrap text-green-700' : 'whitespace-nowrap text-red-500'
        }
      >
        {formatAmountWithCurrency(value, currency)}
      </p>
    </Indicator>
  );
};
