import gql from 'graphql-tag';
import { CSSProperties } from 'react';

import { BankDescriptionFieldsFragment } from '../../../__generated__/types';

gql`
  fragment BankDescriptionFields on Charge {
    transactions {
      id
      description
    }
  }
`;

type Props = {
  description: BankDescriptionFieldsFragment['transactions'][0]['description'];
  style?: CSSProperties;
};

export const BankDescription = ({ description = '', style }: Props) => {
  return <td style={{ ...style }}>{description}</td>;
};
