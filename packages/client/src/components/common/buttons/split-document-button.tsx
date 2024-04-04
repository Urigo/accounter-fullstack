import { ReactElement, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { ArrowsSplit } from 'tabler-icons-react';
import { ActionIcon, Modal, NumberInput, Switch, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Currency,
  SplitDocumentsButtonFieldsFragmentDoc,
  type SplitDocumentMutationVariables,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { currencyCodeToSymbol, formatStringifyAmount } from '../../../helpers/index.js';
import { useSplitDocument } from '../../../hooks/use-split-document.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SplitDocumentsButtonFields on Document {
    id
    ... on Invoice {
      amount {
        raw
        currency
      }
    }
    ... on InvoiceReceipt {
      amount {
        raw
        currency
      }
    }
    ... on Proforma {
      amount {
        raw
        currency
      }
    }
    ... on Receipt {
      amount {
        raw
        currency
      }
    }
    ... on CreditInvoice {
      amount {
        raw
        currency
      }
    }
  }
`;

type ButtonProps = {
  document: FragmentType<typeof SplitDocumentsButtonFieldsFragmentDoc>;
};

export function SplitDocumentsButton({ document: data }: ButtonProps): ReactElement {
  const document = getFragmentData(SplitDocumentsButtonFieldsFragmentDoc, data);
  const disabled = !('amount' in document);
  const [isLoading, setIsLoading] = useState(false);
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Split document">
        <ActionIcon disabled={disabled} loading={isLoading} size={30} onClick={open}>
          <ArrowsSplit size={20} />
        </ActionIcon>
      </Tooltip>
      {opened && !disabled && (
        <ModalContent
          opened={opened}
          close={close}
          setIsLoading={setIsLoading}
          documentId={document.id}
          currentAmount={document.amount!.raw}
          currency={document.amount!.currency}
        />
      )}
    </>
  );
}

type ModalProps = {
  opened: boolean;
  close: () => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  documentId: string;
  currentAmount: number;
  currency: Currency;
};

function ModalContent({
  opened,
  close,
  setIsLoading,
  documentId,
  currentAmount,
  currency,
}: ModalProps): ReactElement {
  const { control, handleSubmit } = useForm<SplitDocumentMutationVariables>({
    defaultValues: { documentId },
  });

  const { splitDocument, fetching: fetchingDocuments } = useSplitDocument();

  useEffect(() => {
    setIsLoading(fetchingDocuments);
  }, [fetchingDocuments, setIsLoading]);

  const onSubmit: SubmitHandler<SplitDocumentMutationVariables> = data => {
    splitDocument(data);
    close();
  };

  return (
    <Modal opened={opened} onClose={close} size="auto" centered>
      <Modal.Title>Split Document</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col justify-center mt-5 gap-3">
            <Controller
              name="splitAmount"
              control={control}
              render={({ field, fieldState }): ReactElement => (
                <>
                  <NumberInput
                    {...field}
                    hideControls
                    label="Amount to split"
                    defaultValue={currentAmount / 2}
                    precision={2}
                    min={0}
                    step={0.01}
                    max={currentAmount}
                    error={fieldState.error?.message}
                    icon={`${currencyCodeToSymbol(currency)} `}
                  />
                  <Text
                    c="dimmed"
                    fz="sm"
                  >{`Remaining Amount: ${currencyCodeToSymbol(currency)} ${formatStringifyAmount(currentAmount - field.value)}`}</Text>
                </>
              )}
            />

            <Controller
              name="underSameCharge"
              control={control}
              defaultValue={false}
              render={({ field: { value, ...field } }): ReactElement => (
                <Switch {...field} checked={value === true} label="Keep under same charge" />
              )}
            />

            <div className="flex justify-center mt-5 gap-3">
              <button
                type="submit"
                className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
              >
                Split
              </button>
            </div>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
}
