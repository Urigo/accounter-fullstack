import { useMemo, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { BankDepositInfoDocument } from '../../../gql/graphql.js';
import { TransactionsTable } from '../../transactions-table/index.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BankDepositInfo($chargeId: UUID!) {
    depositByCharge(chargeId: $chargeId) {
      id
      balance {
        formatted
      }
      transactions {
        id
        chargeId
        ...TransactionForTransactionsTableFields
      }
      isOpen
    }
  }
`;

type Props = {
  chargeId: string;
};

export const ChargeBankDeposit = ({ chargeId }: Props): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: BankDepositInfoDocument,
    variables: {
      chargeId,
    },
  });

  const transactions = useMemo(
    () => data?.depositByCharge?.transactions?.filter(t => t.chargeId !== chargeId) ?? [],
    [data?.depositByCharge?.transactions, chargeId],
  );

  return fetching ? (
    <Loader2 className="h-10 w-10 animate-spin" />
  ) : data?.depositByCharge ? (
    <div>
      <div className="text-lg font-semibold mb-4">
        Bank Deposit "{data?.depositByCharge?.id}" Balance:{' '}
        {data?.depositByCharge?.balance.formatted}
      </div>
      <div className="mb-4">
        <span className="text-sm text-gray-500">
          {data?.depositByCharge?.isOpen ? 'Deposit is open' : 'Deposit is closed'}
        </span>
      </div>
      {transactions.length === 0 ? (
        <div className="text-sm text-gray-500">No transactions found for this deposit.</div>
      ) : (
        <TransactionsTable transactionsProps={transactions} enableChargeLink />
      )}
    </div>
  ) : (
    <div className="text-sm text-gray-500">No bank deposit found for this charge.</div>
  );
};
