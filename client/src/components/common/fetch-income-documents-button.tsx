import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { FileDownload } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Modal, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { AllFinancialEntitiesDocument } from '../../gql/graphql';
import { useFetchIncomeDocuments } from '../../hooks/use-fetch-income-documents';

export function FetchIncomeDocumentsButton() {
  const [financialEntities, setFinancialEntities] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [opened, { close, open }] = useDisclosure(false);
  const [{ data, fetching: fetchingBusinesses, error: financialEntitiesError }] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  const { control, handleSubmit } = useForm<{ ownerId: string }>({
    defaultValues: { ownerId: '6a20aa69-57ff-446e-8d6a-1e96d095e988' },
  });

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (data?.allFinancialEntities.length) {
      setFinancialEntities(
        data.allFinancialEntities
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [data, setFinancialEntities]);

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
      });
    }
  }, [financialEntitiesError]);

  const { fetchIncomeDocuments, fetching: fetchingDocuments } = useFetchIncomeDocuments();

  const onSubmit: SubmitHandler<{ ownerId: string }> = data => {
    fetchIncomeDocuments(data);
    close();
  };

  return (
    <>
      <ActionIcon loading={fetchingDocuments || fetchingBusinesses} size={30} onClick={open}>
        <FileDownload size={20} />
      </ActionIcon>
      <Modal opened={opened} onClose={close} size="auto" centered>
        <Modal.Title>Fetch Income Documents</Modal.Title>
        <Modal.Body>
          {fetchingBusinesses ? <div>Loading...</div> : <div />}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Controller
              name="ownerId"
              control={control}
              // defaultValue={isDocumentProcessed ? document?.debtor?.id : undefined}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  data={financialEntities}
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
                className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
              >
                Fetch
              </button>
            </div>
          </form>
        </Modal.Body>
      </Modal>
    </>
  );
}
