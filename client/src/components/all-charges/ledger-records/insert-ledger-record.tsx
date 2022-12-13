import { SubmitHandler, useForm } from 'react-hook-form';
import { InsertDbLedgerRecordInput } from '../../../gql/graphql';
import { useInsertDbLedgerRecord } from '../../../hooks/use-insert-db-ledger-record';
import { SimpleGrid } from '../../common/simple-grid';
import { InsertDbLedgerRecordFields } from './insert-db-ledger-record-fields';

type Props = {
  chargeId: string;
  closeModal?: () => void;
};

export const InsertLedgerRecord = ({ chargeId, closeModal }: Props) => {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    unregister,
    formState: { dirtyFields },
  } = useForm<InsertDbLedgerRecordInput>();
  const { insertDbLedgerRecord, fetching } = useInsertDbLedgerRecord();

  const onSubmit: SubmitHandler<InsertDbLedgerRecordInput> = data => {
    // const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    // if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
    //   const record = dataToUpdate;
    // // NOTE: manually add dummy local currency (required by schema)
    // if (record.localCurrencyAmount) {
    //   record.localCurrencyAmount.currency = Currency.Ils;
    // }
    insertDbLedgerRecord({
      chargeId,
      record: data,
    });
    if (closeModal) {
      closeModal();
    }
    // }
  };

  return (
    <div className=" px-5 w-max h-max justify-items-center">
      <form onSubmit={handleSubmit(onSubmit)}>
        <SimpleGrid cols={5}>
          {/* <InsertLedgerRecordFields control={control} /> */}
          {/* TEMPORARY: the form is replaced to represent full DB record. should be reverted after DB is updated. */}
          <InsertDbLedgerRecordFields
            control={control}
            watch={watch}
            setValue={setValue}
            unregister={unregister}
          />
        </SimpleGrid>
        <div className="flex justify-center gap-5">
          <button
            type="submit"
            className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={fetching || Object.keys(dirtyFields).length === 0}
          >
            Accept
          </button>
          <button
            type="button"
            className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
            onClick={closeModal}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
