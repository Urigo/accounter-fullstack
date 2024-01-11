import { ReactElement } from 'react';
import { SalariesRecordWorkFrameFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SalariesRecordWorkFrameFields on Salary {
    month
    employee {
      id
    }
    vacationDays {
      added
      taken
      balance
    }
    workDays
    sicknessDays {
      balance
    }
  }
`;

interface Props {
  data: FragmentType<typeof SalariesRecordWorkFrameFieldsFragmentDoc>;
}

export const WorkFrameCell = ({ data }: Props): ReactElement => {
  // TODO: (not in use)
  //     hourly_rate
  //     hours

  const { vacationDays, workDays, sicknessDays } = getFragmentData(
    SalariesRecordWorkFrameFieldsFragmentDoc,
    data,
  );
  const { added, taken, balance } = vacationDays ?? {};
  const { balance: sicknessDaysBalance } = sicknessDays ?? {};

  const isVacationInfo = !!added || !!taken || !!balance;

  return (
    <td className="pl-5">
      <div className="flex items-center">
        <div className="flex flex-col">
          {!!workDays && (
            <>
              <p className="text-md leading-none text-gray-800">Work Days:</p>
              <div className="flex justify-between">
                <p className="text-sm leading-none text-gray-600 ml-2">{workDays}</p>
              </div>
            </>
          )}
          {isVacationInfo && (
            <div className="flex flex-col">
              <p className="text-md leading-none text-gray-800 mt-2">Vacation Days:</p>
              {!!added && (
                <div className="flex justify-between">
                  <p className="text-sm leading-none text-gray-600 ml-2">Added:</p>
                  <p className="text-sm leading-none text-gray-600 ml-2">{added}</p>
                </div>
              )}
              {!!taken && (
                <div className="flex justify-between">
                  <p className="text-sm leading-none text-gray-600 ml-2">Taken:</p>
                  <p className="text-sm leading-none text-gray-600 ml-2">{taken}</p>
                </div>
              )}
              {!!balance && (
                <div className="flex justify-between">
                  <p className="text-sm leading-none text-gray-600 ml-2">Balance:</p>
                  <p className="text-sm leading-none text-gray-600 ml-2">{balance}</p>
                </div>
              )}
            </div>
          )}
          {!!sicknessDaysBalance && (
            <>
              <p className="text-md leading-none text-gray-800 mt-2">Sickness Days:</p>
              <div className="flex justify-between">
                <p className="text-sm leading-none text-gray-600 ml-2">{sicknessDaysBalance}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </td>
  );
};
