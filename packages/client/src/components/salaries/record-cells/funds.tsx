import { ReactElement } from 'react';
import { SalariesRecordFundsFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SalariesRecordFundsFields on Salary {
    month
    employee {
      id
    }
    pensionFund {
      id
      name
    }
    pensionEmployeeAmount {
      formatted
      raw
    }
    pensionEmployeePercentage
    pensionEmployerAmount {
      formatted
      raw
    }
    pensionEmployerPercentage
    compensationsAmount {
      formatted
      raw
    }
    compensationsPercentage
    trainingFund {
      id
      name
    }
    trainingFundEmployeeAmount {
      formatted
      raw
    }
    trainingFundEmployeePercentage
    trainingFundEmployerAmount {
      formatted
      raw
    }
    trainingFundEmployerPercentage
  }
`;

interface Props {
  data: FragmentType<typeof SalariesRecordFundsFieldsFragmentDoc>;
}

export const FundsCell = ({ data }: Props): ReactElement => {
  const {
    pensionEmployeeAmount,
    pensionEmployeePercentage,
    pensionEmployerAmount,
    pensionEmployerPercentage,
    compensationsAmount,
    compensationsPercentage,
    pensionFund,
    trainingFund,
    trainingFundEmployeeAmount,
    trainingFundEmployeePercentage,
    trainingFundEmployerAmount,
    trainingFundEmployerPercentage,
  } = getFragmentData(SalariesRecordFundsFieldsFragmentDoc, data);

  return (
    <td className="pl-5">
      <div className="flex items-center">
        <div className="flex flex-col">
          <p className="text-md font-bold text-gray-800">Pension Fund</p>
          <p className="text-md font-medium text-gray-800">{pensionFund?.name}</p>
          {!!pensionEmployeeAmount?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Employee Part:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">
                {pensionEmployeeAmount?.formatted}
                {pensionEmployeePercentage && ` (${pensionEmployeePercentage}%)`}
              </p>
            </div>
          )}
          {!!pensionEmployerAmount?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Employer Part:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">
                {pensionEmployerAmount?.formatted}
                {pensionEmployerPercentage && ` (${pensionEmployerPercentage}%)`}
              </p>
            </div>
          )}
          {!!compensationsAmount?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Compensations Amount:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">
                {compensationsAmount?.formatted}
                {compensationsPercentage && ` (${compensationsPercentage}%)`}
              </p>
            </div>
          )}

          <p className="text-md font-bold text-gray-800 mt-2">Training Fund</p>
          <p className="text-md font-medium text-gray-800">{trainingFund?.name}</p>
          {!!trainingFundEmployeeAmount?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Employee Part:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">
                {trainingFundEmployeeAmount?.formatted}
                {trainingFundEmployeePercentage && ` (${trainingFundEmployeePercentage}%)`}
              </p>
            </div>
          )}
          {!!trainingFundEmployerAmount?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Employer Part:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">
                {trainingFundEmployerAmount?.formatted}
                {trainingFundEmployerPercentage && ` (${trainingFundEmployerPercentage}%)`}
              </p>
            </div>
          )}
        </div>
      </div>
    </td>
  );
};
