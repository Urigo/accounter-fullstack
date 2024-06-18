import { ReactElement, useEffect, useState } from 'react';
import { Indicator } from '@mantine/core';
import { AllChargesAmountFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesAmountFields on Charge {
    __typename
    id
    totalAmount {
      raw
      formatted
    }
    ... on CreditcardBankCharge @defer {
      validCreditCardAmount
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesAmountFieldsFragmentDoc>;
};

export const Amount = ({ data }: Props): ReactElement => {
  const charge = getFragmentData(AllChargesAmountFieldsFragmentDoc, data);
  const [isValid, setIsValid] = useState(true);
  const [isValidating, setIsValidating] = useState(true);

  const validCreditCardAmount =
    'validCreditCardAmount' in charge ? charge.validCreditCardAmount : null;

  useEffect(() => {
    if (charge.__typename === 'CreditcardBankCharge') {
      setIsValidating(validCreditCardAmount == null);
      if (validCreditCardAmount != null) {
        setIsValid(validCreditCardAmount);
      }
    }
  }, [charge.__typename, validCreditCardAmount]);

  return (
    <td>
      <div>
        <Indicator
          inline
          size={12}
          disabled={isValid}
          processing={isValidating}
          color="red"
          zIndex="auto"
        >
          <p
            className={
              (charge.totalAmount?.raw ?? 0) > 0
                ? 'whitespace-nowrap text-green-700'
                : 'whitespace-nowrap text-red-500'
            }
          >
            {charge.totalAmount?.formatted}
          </p>
        </Indicator>
      </div>
    </td>
  );
};
