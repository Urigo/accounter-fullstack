import { ReactElement } from 'react';
import { SalariesRecordInsurancesAndTaxesFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SalariesRecordInsurancesAndTaxesFields on Salary {
    month
    employee {
      id
    }
    healthInsuranceAmount {
      formatted
      raw
    }
    socialSecurityEmployeeAmount {
      formatted
      raw
    }
    socialSecurityEmployerAmount {
      formatted
      raw
    }
    incomeTaxAmount {
      formatted
      raw
    }
    notionalExpense {
      formatted
      raw
    }
  }
`;

interface Props {
  data: FragmentType<typeof SalariesRecordInsurancesAndTaxesFieldsFragmentDoc>;
}

export const InsurancesAndTaxesCell = ({ data }: Props): ReactElement => {
  const {
    healthInsuranceAmount,
    socialSecurityEmployeeAmount,
    socialSecurityEmployerAmount,
    incomeTaxAmount,
    notionalExpense,
  } = getFragmentData(SalariesRecordInsurancesAndTaxesFieldsFragmentDoc, data);

  const isSocialSecurityInfo = !!socialSecurityEmployeeAmount || !!socialSecurityEmployerAmount;

  return (
    <td className="pl-5">
      <div className="flex items-center pl-5">
        <div className="flex flex-col">
          {isSocialSecurityInfo && (
            <>
              <p className="text-md font-bold text-gray-800">Social Security</p>
              <div className="flex justify-between">
                <p className="text-sm leading-none text-gray-600 ml-2">Employee Part:</p>
                <p className="text-sm leading-none text-gray-600 ml-2">
                  {socialSecurityEmployeeAmount?.formatted}
                </p>
              </div>
              <p className="text-md font-bold text-gray-800 mt-2">Pension Fund</p>
              <div className="flex justify-between">
                <p className="text-sm leading-none text-gray-600 ml-2">Employer Part:</p>
                <p className="text-sm leading-none text-gray-600 ml-2">
                  {socialSecurityEmployerAmount?.formatted}
                </p>
              </div>
            </>
          )}
          {!!healthInsuranceAmount?.raw && (
            <>
              <p className="text-md font-bold text-gray-800 mt-2">Health Insurance</p>
              <div className="flex justify-between">
                <p className="text-sm leading-none text-gray-600 ml-2">Amount:</p>
                <p className="text-sm leading-none text-gray-600 ml-2">
                  {healthInsuranceAmount?.formatted}
                </p>
              </div>
            </>
          )}
          {(!!incomeTaxAmount?.raw || !!notionalExpense?.raw) && (
            <>
              <p className="text-md font-bold text-gray-800 mt-2">Taxes</p>
              <div className="flex justify-between">
                <p className="text-sm leading-none text-gray-600 ml-2">Income Tax:</p>
                <p className="text-sm leading-none text-gray-600 ml-2">
                  {incomeTaxAmount?.formatted}
                </p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm leading-none text-gray-600 ml-2">Notional Expense:</p>
                <p className="text-sm leading-none text-gray-600 ml-2">
                  {notionalExpense?.formatted}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </td>
  );
};
