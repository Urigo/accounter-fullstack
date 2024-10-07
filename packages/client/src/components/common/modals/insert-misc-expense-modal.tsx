import { ReactElement } from 'react';
import { PlaylistAdd } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Modal, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MiscExpenseTransactionFieldsDocument } from '../../../gql/graphql.js';
import { InsertMiscExpense } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MiscExpenseTransactionFields($transactionId: UUID!) {
    transactionsByIDs(transactionIDs: [$transactionId]) {
      id
      chargeId
      amount {
        raw
        currency
      }
      eventDate
      effectiveDate
      counterparty {
        id
      }
    }
  }
`;

interface Props {
  chargeId: string;
  transactionId: string;
  onDone?: () => void;
}

export const InsertMiscExpenseModal = ({
  onDone,
  transactionId,
  chargeId,
}: Props): ReactElement => {
  const [opened, { open, close }] = useDisclosure(false);

  const [{ data: transactionData, fetching: fetchingTransaction }] = useQuery({
    query: MiscExpenseTransactionFieldsDocument,
    pause: !transactionId,
    variables: {
      transactionId,
    },
  });

  const transaction = transactionData?.transactionsByIDs[0];

  function onInsertDone(): void {
    close();
    onDone?.();
  }
  return (
    <>
      <Tooltip label="Insert Related Misc Expense">
        <ActionIcon onClick={open} loading={fetchingTransaction}>
          <PlaylistAdd size={20} />
        </ActionIcon>
      </Tooltip>
      {transaction && (
        <Modal centered opened={opened} onClose={close} title="Insert Misc Expense">
          <InsertMiscExpense
            onDone={onInsertDone}
            chargeId={chargeId}
            defaultValues={{
              amount: transaction?.amount.raw,
              currency: transaction?.amount.currency,
              invoiceDate: transaction?.eventDate,
              valueDate: transaction?.effectiveDate
                ? new Date(transaction?.effectiveDate)
                : undefined,
              creditorId:
                (transaction?.amount.raw ?? 0) > 0 ? transaction?.counterparty?.id : undefined,
              debtorId:
                (transaction?.amount.raw ?? 0) < 0 ? transaction?.counterparty?.id : undefined,
            }}
          />
        </Modal>
      )}
    </>
  );
};
