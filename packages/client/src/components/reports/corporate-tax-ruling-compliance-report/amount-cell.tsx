import { ReactElement } from 'react';
import { FragmentType, getFragmentData } from '../../../gql/fragment-masking.js';
import { CorporateTaxRulingReportAmountCellFieldsFragmentDoc } from '../../../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment CorporateTaxRulingReportAmountCellFields on FinancialAmount {
    formatted
  }
`;

type Props = {
  originalAmountData: FragmentType<typeof CorporateTaxRulingReportAmountCellFieldsFragmentDoc>;
  diffAmountData?: FragmentType<typeof CorporateTaxRulingReportAmountCellFieldsFragmentDoc>;
};

export const AmountCell = ({ originalAmountData, diffAmountData }: Props): ReactElement => {
  const originalAmount = getFragmentData(
    CorporateTaxRulingReportAmountCellFieldsFragmentDoc,
    originalAmountData,
  );
  const diffAmount = getFragmentData(
    CorporateTaxRulingReportAmountCellFieldsFragmentDoc,
    diffAmountData,
  );

  if (!diffAmount) {
    return <td>{originalAmount.formatted}</td>;
  }

  return (
    <td>
      <div className="flex flex-col">
        <p className={diffAmount ? 'line-through' : ''}>{originalAmount.formatted}</p>
        {diffAmount && (
          <div className="border-2 border-yellow-500 rounded-md">{diffAmount?.formatted}</div>
        )}
      </div>
    </td>
  );
};
