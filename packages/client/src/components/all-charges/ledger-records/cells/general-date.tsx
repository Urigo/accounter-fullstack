import { ReactElement } from 'react';
import { format } from 'date-fns';
import { LedgerRecordsGeneralDateFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

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
  diff?: FragmentType<typeof LedgerRecordsGeneralDateFieldsFragmentDoc> | null;
  type: 1 | 2;
};

export const GeneralDate = ({ data, diff, type }: Props): ReactElement => {
  const { invoiceDate, valueDate } = getFragmentData(
    LedgerRecordsGeneralDateFieldsFragmentDoc,
    data,
  );

  const showDate = type === 1 ? invoiceDate : valueDate;

  const formattedDate = showDate ? format(new Date(showDate), 'dd/MM/yy') : undefined;

  // calculate diff date
  const { invoiceDate: diffInvoiceDate, valueDate: diffValueDate } =
    getFragmentData(LedgerRecordsGeneralDateFieldsFragmentDoc, diff) ?? {};
  const diffShowDate = type === 1 ? diffInvoiceDate : diffValueDate;
  const diffFormattedDate = diffShowDate ? format(new Date(diffShowDate), 'dd/MM/yy') : undefined;

  return (
    <td>
      {formattedDate ?? 'Missing Data'}
      {diffFormattedDate && showDate !== diffShowDate && (
        <div className="flex flex-col border-2 border-yellow-500 rounded-md">
          {diffFormattedDate}
        </div>
      )}
    </td>
  );
};
