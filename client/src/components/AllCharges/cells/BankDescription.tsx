import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../models/types';
import gql from 'graphql-tag';
import { BankDescriptionFieldsFragment } from '../../../__generated__/types';

gql`
  fragment bankDescriptionFields on Charge {
    description
  }
`;

type Props = {
  description: BankDescriptionFieldsFragment['description'];
  style?: CSSProperties;
};

export const BankDescription: FC<Props> = ({ description = '', style }) => {
  return <td style={{ ...style }}>{description}</td>;
};
