import { ReactElement } from 'react';
import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { LedgerRecordsGeneralDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* TEMPORARY: this component is used for temporary reasons */

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment LedgerRecordsGeneralDateFields on LedgerRecord {
    id
    invoiceDate
    valueDate
  }
`;

type Props = {
  data: FragmentType<typeof LedgerRecordsGeneralDateFieldsFragmentDoc>;
  type: 1 | 2;
};

export const GeneralDate = ({ data, type }: Props): ReactElement => {
  const { invoiceDate, valueDate } = getFragmentData(
    LedgerRecordsGeneralDateFieldsFragmentDoc,
    data,
  );

  const showDate = type === 1 ? invoiceDate : valueDate;

  const formattedDate = invoiceDate ? format(new Date(showDate), 'dd/MM/yy') : 'Missing Data';

  return <td>{formattedDate}</td>;
};
