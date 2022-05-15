import { CSSProperties, FC } from 'react';
import {
  businessesWithoutTaxCategory,
  businessesWithoutVAT,
  SuggestedCharge,
} from '../../../helpers';
import gql from 'graphql-tag';
import { Currency, VatFieldsFragment } from '../../../__generated__/types';

gql`
  fragment vatFields on FinancialEntity {
    __typename
    ... on LtdFinancialEntity {
      name
    }
    charges {
      vat {
        raw
        formatted
        currency
      }
      transactions {
        amount {
          raw
        }
      }
    }
  }
`;

type Props = {
  financialEntityType: VatFieldsFragment['__typename'];
  financialEntityName?: string;
  vat: VatFieldsFragment['charges'][0]['vat'];
  amount?: VatFieldsFragment['charges'][0]['transactions'][0]['amount']['raw'];
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Vat: FC<Props> = ({
  financialEntityType,
  financialEntityName = '',
  vat,
  amount = 0,
  alternativeCharge,
  style,
}) => {
  const indicator =
    (!vat?.raw &&
      financialEntityType === 'LtdFinancialEntity' &&
      (!vat || vat.currency === Currency.Nis) &&
      !businessesWithoutVAT.includes(financialEntityName) &&
      !businessesWithoutTaxCategory.includes(financialEntityName)) ||
    (vat?.raw && ((vat.raw > 0 && amount < 0) || (vat.raw < 0 && amount > 0)));

  const cellText = vat?.formatted ?? alternativeCharge?.vat?.formatted;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {/* {!transaction.vat && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'vat'}
          value={cellText?.toString()}
        />
      )} */}
      {/* <UpdateButton
        transaction={transaction}
        propertyName={'vat'}
        promptText="New VAT:"
      /> */}
    </td>
  );
};
