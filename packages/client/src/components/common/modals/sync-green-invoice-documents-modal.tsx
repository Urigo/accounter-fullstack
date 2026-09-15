import { useEffect, type ReactElement } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { useGetAdminBusinesses } from '@/hooks/use-get-admin-businesses.js';
import { useSyncGreenInvoiceDocuments } from '../../../hooks/use-sync-green-invoice-documents.js';
import { ComboBox } from '../../common/inputs/combo-box.js';
import { PopUpModal } from './modal.js';

type ModalProps = {
  opened: boolean;
  close: () => void;
  setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
};

export function SyncDocumentsModal({ opened, close, setIsLoading }: ModalProps): ReactElement {
  const {
    selectableAdminBusinesses: adminBusinesses,
    fetching: fetchingAdminBusinesses,
    soleAdminBusinessId,
  } = useGetAdminBusinesses();

  const { control, handleSubmit, setValue } = useForm<{ ownerId: string }>({
    defaultValues: { ownerId: '' },
  });

  // A single admin business is not a choice: pre-select it so the (disabled) input
  // and the submitted value agree.
  useEffect(() => {
    if (soleAdminBusinessId) {
      setValue('ownerId', soleAdminBusinessId);
    }
  }, [soleAdminBusinessId, setValue]);

  const { syncGreenInvoiceDocuments, fetching: syncingDocuments } = useSyncGreenInvoiceDocuments();

  useEffect(() => {
    setIsLoading?.(fetchingAdminBusinesses || syncingDocuments);
  }, [fetchingAdminBusinesses, syncingDocuments, setIsLoading]);

  const onSubmit: SubmitHandler<{ ownerId: string }> = data => {
    syncGreenInvoiceDocuments(data);
    close();
  };

  return (
    <PopUpModal
      opened={opened}
      onClose={close}
      withCloseButton
      modalSize="auto"
      title="Sync Green Invoice Documents"
    >
      {fetchingAdminBusinesses ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="ownerId"
          control={control}
          rules={{ required: 'Owner is required' }}
          render={({ field, fieldState }): ReactElement => (
            <ComboBox
              {...field}
              data={adminBusinesses}
              value={soleAdminBusinessId ?? field.value}
              disabled={fetchingAdminBusinesses || !!soleAdminBusinessId}
              label="Owner:"
              placeholder="Scroll to see all options"
              error={fieldState.error?.message}
            />
          )}
        />

        <div className="flex justify-center mt-5 gap-3">
          <button
            type="submit"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
          >
            Sync
          </button>
        </div>
      </form>
    </PopUpModal>
  );
}
