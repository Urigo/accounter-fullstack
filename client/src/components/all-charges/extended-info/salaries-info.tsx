import { ReactElement } from 'react';
import { TableSalariesFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableSalariesFields on Charge {
    id
    salaryRecords {
      directAmount {
        formatted
      }
      baseAmount {
        formatted
      }
			employeeId
    }
  }
`;

type Props = {
  salaryRecordsProps: FragmentType<typeof TableSalariesFieldsFragmentDoc>;
};

export const SalariesTable = ({ salaryRecordsProps }: Props): ReactElement => {
  const { salaryRecords } = getFragmentData(TableSalariesFieldsFragmentDoc, salaryRecordsProps);
  return (
    <table className="w-full h-full">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Direct Amount</th>
          <th>Base Amount</th>
        </tr>
      </thead>
      <tbody>
        {salaryRecords.map((record, i) => (
          <tr key={i}>
            <td>
              <div>{record.employeeId}</div>
            </td>
            <td>
              <div>{record.directAmount.formatted}</div>
            </td>
            <td>
              <div>{record.baseAmount?.formatted}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
