import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';

export const TableSalariesFieldsFragmentDoc = graphql(`
  fragment TableSalariesFields on Charge {
    id
    __typename
    ... on SalaryCharge @defer {
      salaryRecords {
        directAmount {
          formatted
        }
        baseAmount {
          formatted
        }
        employee {
          id
          name
        }
        pensionFund {
          id
          name
        }
        pensionEmployeeAmount {
          formatted
        }
        pensionEmployerAmount {
          formatted
        }
        compensationsAmount {
          formatted
        }
        trainingFund {
          id
          name
        }
        trainingFundEmployeeAmount {
          formatted
        }
        trainingFundEmployerAmount {
          formatted
        }
        socialSecurityEmployeeAmount {
          formatted
        }
        socialSecurityEmployerAmount {
          formatted
        }
        incomeTaxAmount {
          formatted
        }
        healthInsuranceAmount {
          formatted
        }
      }
    }
  }
`);

export function isTableSalariesFieldsFragmentReady(
  data?: object | FragmentOf<typeof TableSalariesFieldsFragmentDoc>,
): data is FragmentOf<typeof TableSalariesFieldsFragmentDoc> {
  if (!!data && '__typename' in data && data.__typename === 'SalaryCharge') {
    return true;
  }
  return false;
}

type Props = {
  salaryRecordsProps: FragmentOf<typeof TableSalariesFieldsFragmentDoc>;
};

export const SalariesTable = ({ salaryRecordsProps }: Props): ReactElement => {
  const charge = readFragment(TableSalariesFieldsFragmentDoc, salaryRecordsProps);
  if (charge.__typename !== 'SalaryCharge' || !('salaryRecords' in charge)) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  const { salaryRecords } = charge;
  return (
    <table className="w-full h-full">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Direct Salary</th>
          <th>Base Salary</th>
          <th>Pension</th>
          <th>Training Fund</th>
          <th>Social Security</th>
          <th>Tax</th>
        </tr>
      </thead>
      <tbody>
        {salaryRecords?.map(record => (
          <tr key={`${record.employee?.name}-${record.baseAmount}`}>
            <td>
              <div>{record.employee?.name ?? 'Missing'}</div>
            </td>
            <td>
              <div>{record.directAmount.formatted}</div>
            </td>
            <td>
              <div>{record.baseAmount?.formatted}</div>
            </td>
            <td>
              <div>{record.pensionFund?.name}</div>
              <div>Employee: {record.pensionEmployeeAmount?.formatted}</div>
              <div>Employer: {record.pensionEmployerAmount?.formatted}</div>
              <div>Compensation: {record.compensationsAmount?.formatted}</div>
            </td>
            <td>
              <div>{record.trainingFund?.name}</div>
              <div>Employee: {record.trainingFundEmployeeAmount?.formatted}</div>
              <div>Employer: {record.trainingFundEmployerAmount?.formatted}</div>
            </td>
            <td>
              <div>Employee: {record.socialSecurityEmployeeAmount?.formatted}</div>
              <div>Employer: {record.socialSecurityEmployerAmount?.formatted}</div>
              <div>Health: {record.healthInsuranceAmount?.formatted}</div>
            </td>
            <td>
              <div>{record.incomeTaxAmount?.formatted}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
