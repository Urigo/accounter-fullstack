import { ReactElement, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { LayoutGridAdd } from 'tabler-icons-react';
import { ActionIcon, Loader, Modal, Overlay, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { InsertNewBusinessInput } from '../../../gql/graphql.js';
import { useInsertBusiness } from '../../../hooks/use-insert-business.js';
import { InsertBusinessFields } from '../index.js';

export function InsertBusiness(props: {
  description: string;
  onAdd?: (businessId: string) => void;
}): ReactElement {
  const { description, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Create New Business">
        <ActionIcon
          variant="default"
          onClick={(event): void => {
            event.stopPropagation();
            open();
          }}
          size={30}
        >
          <LayoutGridAdd size={20} />
        </ActionIcon>
      </Tooltip>
      {opened && (
        <ModalContent description={description} opened={opened} close={close} onAdd={onAdd} />
      )}
    </>
  );
}

type ModalProps = {
  opened: boolean;
  close: () => void;
  onAdd?: (businessId: string) => void;
  description: string;
};

function ModalContent({ description, opened, close, onAdd }: ModalProps): ReactElement {
  const useFormManager = useForm<InsertNewBusinessInput>({
    defaultValues: { name: description, suggestions: { phrases: [description] } },
  });
  const { handleSubmit } = useFormManager;
  const [fetching, setFetching] = useState(false);

  const { insertBusiness, fetching: addingInProcess } = useInsertBusiness();

  const onSubmit: SubmitHandler<InsertNewBusinessInput> = data => {
    data.sortCode &&= parseInt(data.sortCode.toString());
    insertBusiness({ fields: data }).then(({ id }) => {
      onAdd?.(id);
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered lockScroll size="xl">
      <Modal.Title>Add New Business</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <InsertBusinessFields
            description={description}
            useFormManager={useFormManager}
            setFetching={setFetching}
          />

          <div className="flex justify-center mt-5 gap-3">
            <button
              type="submit"
              className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            >
              Add
            </button>
          </div>
        </form>
      </Modal.Body>
      {(addingInProcess || fetching) && (
        <Overlay blur={1} center>
          <Loader />
        </Overlay>
      )}
    </Modal>
  );
}
