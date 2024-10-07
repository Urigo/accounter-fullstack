import { ReactElement } from 'react';
import { TableMiscExpensesFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { DeleteMiscExpenseButton } from '../../common/buttons/delete-misc-expense-button.js';
import { EditMiscExpenseModal } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableMiscExpensesFields on Charge {
    id
    miscExpenses {
      id
      amount {
        formatted
      }
      description
      invoiceDate
      valueDate
      creditor {
        id
        name
      }
      debtor {
        id
        name
      }
      chargeId
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
          <th>Creditor</th>
          <th>Debtor</th>
          <th>Amount</th>
          <th>Invoice Date</th>
          <th>Value Date</th>
          <th>Description</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {miscExpenses?.map(expense => (
          <tr key={expense?.id}>
            <td>
              <div>{expense.creditor?.name}</div>
            </td>
            <td>
              <div>{expense.debtor?.name}</div>
            </td>
            <td>
              <div>{expense.amount?.formatted}</div>
            </td>
            <td>
              <div>{expense.invoiceDate}</div>
            </td>
            <td>
              <div>{expense.valueDate}</div>
            </td>
            <td>
              <div>{expense.description}</div>
            </td>
            <td>
              <EditMiscExpenseModal onDone={onChange} data={expense} />
              <DeleteMiscExpenseButton miscExpenseId={expense.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
