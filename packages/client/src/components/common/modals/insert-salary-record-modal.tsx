import { Dispatch, ReactElement, SetStateAction, useCallback } from 'react';
import { ModifySalaryRecord, PopUpDrawer } from '..';
import type { SalaryRecordInput } from '../../../gql/graphql.js';
import { useInsertSalaryRecord } from '../../../hooks/use-insert-salary-record.js';

interface Props {
  insertSalaryRecordParams: { month?: string };
  setInsertSalaryRecord: Dispatch<SetStateAction<{ month?: string } | undefined>>;
}

export const InsertSalaryRecordModal = ({
  insertSalaryRecordParams,
  setInsertSalaryRecord,
}: Props): ReactElement => {
  const { insertSalaryRecord, fetching } = useInsertSalaryRecord();

  const doUpdate = useCallback(
    (salaryRecord?: SalaryRecordInput) => {
      console.log('salaryRecord', salaryRecord);
      if (salaryRecord) {
        insertSalaryRecord({
          salaryRecords: [salaryRecord],
        });
      }
      setInsertSalaryRecord(undefined);
    },
    [setInsertSalaryRecord, insertSalaryRecord],
  );

  return (
    <PopUpDrawer
      modalSize="40%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Insert Salary Record:</h1>
        </div>
      }
      opened={!!insertSalaryRecordParams}
      onClose={(): void => setInsertSalaryRecord(undefined)}
    >
      <ModifySalaryRecord
        isNewInsert
        onDone={doUpdate}
        isModifying={fetching}
        month={insertSalaryRecordParams.month}
      />
    </PopUpDrawer>
  );
};
