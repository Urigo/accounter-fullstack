import { ReactElement, useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Modal, Select } from '@mantine/core';
import { useFetchIncomeDocuments } from '../../../hooks/use-fetch-income-documents.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';

type ModalProps = {
  opened: boolean;
  close: () => void;
  setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
};

export function PullDocumentsModal({ opened, close, setIsLoading }: ModalProps): ReactElement {
  const { selectableBusinesses: businesses, fetching: fetchingBusinesses } = useGetBusinesses();

  const { control, handleSubmit } = useForm<{ ownerId: string }>({
    defaultValues: { ownerId: '6a20aa69-57ff-446e-8d6a-1e96d095e988' },
  });

  const { fetchIncomeDocuments, fetching: fetchingDocuments } = useFetchIncomeDocuments();

  useEffect(() => {
    setIsLoading?.(fetchingBusinesses || fetchingDocuments);
  }, [fetchingBusinesses, fetchingDocuments, setIsLoading]);

  const onSubmit: SubmitHandler<{ ownerId: string }> = data => {
    fetchIncomeDocuments(data);
    close();
  };

  return (
    <Modal opened={opened} onClose={close} size="auto" centered>
      <Modal.Title>Fetch Income Documents</Modal.Title>
      <Modal.Body>
        {fetchingBusinesses ? <div>Loading...</div> : <div />}
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="ownerId"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                data={businesses}
                value={field.value}
                disabled={fetchingBusinesses}
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
              Fetch
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
}
