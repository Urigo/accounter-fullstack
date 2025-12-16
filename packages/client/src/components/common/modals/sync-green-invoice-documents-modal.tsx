import { useEffect, type ReactElement } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Modal, Select } from '@mantine/core';
import { useGetAdminBusinesses } from '@/hooks/use-get-admin-businesses.js';
import { useSyncGreenInvoiceDocuments } from '../../../hooks/use-sync-green-invoice-documents.js';

type ModalProps = {
  opened: boolean;
  close: () => void;
  setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
};

export function SyncDocumentsModal({ opened, close, setIsLoading }: ModalProps): ReactElement {
  const { selectableAdminBusinesses: adminBusinesses, fetching: fetchingAdminBusinesses } =
    useGetAdminBusinesses();

  const { control, handleSubmit } = useForm<{ ownerId: string }>({
    defaultValues: { ownerId: '6a20aa69-57ff-446e-8d6a-1e96d095e988' },
  });

  const { syncGreenInvoiceDocuments, fetching: syncingDocuments } = useSyncGreenInvoiceDocuments();

  useEffect(() => {
    setIsLoading?.(fetchingAdminBusinesses || syncingDocuments);
  }, [fetchingAdminBusinesses, syncingDocuments, setIsLoading]);

  const onSubmit: SubmitHandler<{ ownerId: string }> = data => {
    syncGreenInvoiceDocuments(data);
    close();
  };

  return (
    <Modal opened={opened} onClose={close} size="auto" centered>
      <Modal.Title>Sync Green Invoice Documents</Modal.Title>
      <Modal.Body>
        {fetchingAdminBusinesses ? <div>Loading...</div> : <div />}
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="ownerId"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                data={adminBusinesses}
                value={field.value}
                disabled={fetchingAdminBusinesses}
                label="Owner:"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
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
      </Modal.Body>
    </Modal>
  );
}
