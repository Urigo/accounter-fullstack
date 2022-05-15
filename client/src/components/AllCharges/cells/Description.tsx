import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';
import type { SuggestedCharge } from '../../../helpers';

gql`
  fragment descriptionFields on Charge {
    transactions {
      description
    }
  }
`;

type Props = {
  description: string;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Description: FC<Props> = ({
  description,
  alternativeCharge,
  style,
}) => {
  const isDescription = !(description === '');
  const cellText = description ?? alternativeCharge?.userDescription;

  return (
    <td
      style={{
        ...(isDescription ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {/* {!transaction.user_description && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'user_description'}
          value={cellText}
        />
      )} */}
      {/* <UpdateButton
        transaction={transaction}
        propertyName={'user_description'}
        promptText="New user description:"
      /> */}
    </td>
  );
};
