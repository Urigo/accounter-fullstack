import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';
import type { SuggestedCharge } from '../../../helpers';

gql`
  fragment categoryFields on Charge {
    tags
  }
`;

type Props = {
  tags: string[];
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Category: FC<Props> = ({ tags, alternativeCharge, style }) => {
  const isPersonalCategory = tags.length === 0;
  const cellText = tags.join(', ') ?? alternativeCharge?.personalCategory;

  return (
    <td
      style={{
        ...(isPersonalCategory ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {/* {!transaction.personal_category && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'personal_category'}
          value={cellText}
        />
      )} */}
      {/* <UpdateButton
        transaction={transaction}
        propertyName={'personal_category'}
        promptText="New personal category:"
      /> */}
    </td>
  );
};
