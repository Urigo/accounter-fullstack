import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';
import type { SuggestedCharge } from '../../../helpers';

gql`
  fragment entityFields on Charge {
    counterparty {
      name
    }
  }
`;

type Props = {
  name: string;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Entity: FC<Props> = ({ name, alternativeCharge, style }) => {
  const isFinancialEntity = !(name === '');
  const cellText = name ?? alternativeCharge?.financialEntity;

  return (
    <td
      style={{
        ...(isFinancialEntity ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {/* {!isFinancialEntity && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'financial_entity'}
          value={cellText}
        />
      )} */}
      {/* <UpdateButton
        transaction={transaction}
        propertyName={'financial_entity'}
        promptText="New financial entity:"
      /> */}
    </td>
  );
};
