import { ReactElement } from 'react';
import { TableMiscExpensesFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { EditMiscExpenseModal } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableMiscExpensesFields on Charge {
    id
    miscExpenses {
      amount {
        formatted
      }
      description
      date
      counterparty {
        id
        name
      }
      transactionId
      ...EditMiscExpenseFields
    }
  }
`;

type Props = {
  miscExpensesData: FragmentType<typeof TableMiscExpensesFieldsFragmentDoc>;
  onChange: () => void;
};

export const ChargeMiscExpensesTable = ({ miscExpensesData, onChange }: Props): ReactElement => {
  const charge = getFragmentData(TableMiscExpensesFieldsFragmentDoc, miscExpensesData);

  const { miscExpenses } = charge;
  return (
    <table className="w-full h-full">
      <thead>
        <tr>
          <th>Counterparty</th>
          <th>Amount</th>
          <th>Date</th>
          <th>Description</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {miscExpenses?.map(expense => (
          <tr key={`${expense?.transactionId}-${expense?.counterparty}-${expense?.date}`}>
            <td>
              <div>{expense?.counterparty?.name}</div>
            </td>
            <td>
              <div>{expense?.amount?.formatted}</div>
            </td>
            <td>
              <div>{expense?.date}</div>
            </td>
            <td>
              <div>{expense?.description}</div>
            </td>
            <td>
              <EditMiscExpenseModal onDone={onChange} data={expense} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
