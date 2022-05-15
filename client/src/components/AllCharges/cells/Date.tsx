import moment from 'moment';
import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';

gql`
  fragment dateFields on Charge {
    transactions {
      id
      createdAt
      effectiveDate
    }
  }
`;

type Props = {
  createdAt: string;
  effectiveDate?: string;
  style?: CSSProperties;
};

export const Date: FC<Props> = ({ createdAt, effectiveDate, style }) => {
  return (
    <td style={{ ...style }}>
      {moment(createdAt).format('DD/MM/YY')}
      {effectiveDate && (
        <div style={{ fontSize: '12px', color: 'gray' }}>
          {moment(effectiveDate).format('DD/MM/YY')}
        </div>
      )}
    </td>
  );
};
