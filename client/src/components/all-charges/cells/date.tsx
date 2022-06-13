import moment from 'moment';
import { CSSProperties } from 'react';
import gql from 'graphql-tag';

gql`
  fragment DateFields on Charge {
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

export const Date = ({ createdAt, effectiveDate, style }: Props) => {
  return (
    <td style={{ ...style }}>
      {moment(createdAt).format('DD/MM/YY')}
      {effectiveDate && (
        <div style={{ fontSize: '12px', color: 'gray' }}>{moment(effectiveDate).format('DD/MM/YY')}</div>
      )}
    </td>
  );
};
