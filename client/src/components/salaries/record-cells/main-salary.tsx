import { ReactElement } from 'react';
import { SalariesRecordMainSalaryFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SalariesRecordMainSalaryFields on Salary {
    month
    employee {
      id
    }
    baseAmount {
      formatted
    }
    directAmount {
      formatted
    }
    globalAdditionalHoursAmount {
      formatted
    }
    bonus {
      formatted
      raw
    }
    gift {
      formatted
      raw
    }
    recovery {
      formatted
      raw
    }
    vacationTakeout {
      formatted
      raw
    }
  }
`;

interface Props {
  data: FragmentType<typeof SalariesRecordMainSalaryFieldsFragmentDoc>;
}

export const MainSalaryCell = ({ data }: Props): ReactElement => {
  const {
    baseAmount,
    directAmount,
    globalAdditionalHoursAmount,
    bonus,
    gift,
    recovery,
    vacationTakeout,
  } = getFragmentData(SalariesRecordMainSalaryFieldsFragmentDoc, data);

  return (
    <td className="pl-24">
      <div className="flex items-center">
        <div className="flex flex-col">
          <div className="flex justify-between">
            <p className="text-sm leading-none text-gray-600 ml-2">Base Amount:</p>
            <p className="text-sm leading-none text-gray-600 ml-2">{baseAmount?.formatted}</p>
          </div>
          <div className="flex justify-between mb-2">
            <p className="text-sm leading-none text-gray-600 ml-2">Global Extra Hours:</p>
            <p className="text-sm leading-none text-gray-600 ml-2">
              {globalAdditionalHoursAmount?.formatted}
            </p>
          </div>
          {!!bonus?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Bonus:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">{bonus?.formatted}</p>
            </div>
          )}
          {!!gift?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Gift:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">{gift?.formatted}</p>
            </div>
          )}
          {!!recovery?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Recovery:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">{recovery?.formatted}</p>
            </div>
          )}
          {!!vacationTakeout?.raw && (
            <div className="flex justify-between">
              <p className="text-sm leading-none text-gray-600 ml-2">Vacation Takeout:</p>
              <p className="text-sm leading-none text-gray-600 ml-2">
                {vacationTakeout?.formatted}
              </p>
            </div>
          )}
          <div className="flex justify-between mt-2">
            <p className="text-sm leading-none text-gray-600 ml-2">Direct Amount:</p>
            <p className="text-sm leading-none text-gray-600 ml-2">{directAmount?.formatted}</p>
          </div>
        </div>
      </div>
    </td>
  );
};
