import { CSSProperties } from 'react';
import gql from 'graphql-tag';
import type { SuggestedCharge } from '../../../helpers';

gql`
  fragment descriptionFields on Charge {
    transactions {
      userNote
    }
  }
`;

type Props = {
  userNote?: string;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Description = ({ userNote, alternativeCharge, style }: Props) => {
  const isDescription = userNote && userNote !== '';
  const cellText = userNote ?? alternativeCharge?.userDescription;

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
