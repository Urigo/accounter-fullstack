import { FormEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSql } from '../hooks/use-sql';
import type { LedgerEntity } from '../models/types';
import { AccounterBasicTable } from './common/accounter-basic-table';

interface ModifiedTransaction {
  counterAccount: string;
  hashavshevet_id?: string;
  date_3?: string;
  value_date?: string;
  invoice_date?: string;
  reference_1?: string;
  reference_2?: string;
  details: string;
  movement_type?: string;
  currency?: string;
  direction: -1 | 1;
  amountForeign: number;
  amountNis: number;
  balanceForeign: number;
  balanceNis: number;
}

interface Props {
  transactions: ModifiedTransaction[];
}

const TransactionTable = ({ transactions }: Props) => {
  const [balanceForeign, setBalanceForeign] = useState(0);
  const [balanceNis, setBalanceNis] = useState(0);

  return (
    <AccounterBasicTable
      content={
        <>
          <thead>
            <tr>
              <th>ח&quot;ן</th>
              <th>חשבשבת#</th>
              <th>date_3</th>
              <th>תאריך_ערך</th>
              <th>invoice_date</th>
              <th>reference_1</th>
              <th>reference_2</th>
              <th>details</th>
              <th>movement_type</th>
              <th>currency</th>
              <th colSpan={2}>חובה/זכות (מט&quot;ח)</th>
              <th>יתרה (מט&quot;ח)</th>
              <th colSpan={2}>חובה/זכות (שקל)</th>
              <th>יתרה (שקל)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td>0.00</td>
              <td></td>
              <td></td>
              <td>0.00</td>
            </tr>
            {transactions.map(transaction => {
              transaction.balanceForeign = balanceForeign + transaction.direction * transaction.amountForeign;
              setBalanceForeign(current => current + transaction.balanceForeign);

              transaction.balanceNis = balanceNis + transaction.direction * transaction.amountNis;
              setBalanceNis(current => current + transaction.balanceNis);
              return (
                <tr key={transaction.hashavshevet_id}>
                  <td>{transaction.counterAccount}</td>
                  <td>{transaction.hashavshevet_id ?? ''}</td>
                  <td>{transaction.date_3 ?? ''}</td>
                  <td>{transaction.value_date ? transaction.value_date : ''}</td>
                  <td>{transaction.invoice_date ? transaction.invoice_date : ''}</td>
                  <td>{transaction.reference_1 ? transaction.reference_1 : ''}</td>
                  <td>{transaction.reference_2 ? transaction.reference_2 : ''}</td>
                  <td>{transaction.details === '0' ? '' : transaction.details}</td>
                  <td>{transaction.movement_type ? transaction.movement_type : ''}</td>
                  <td>{transaction.currency ? transaction.currency : ''}</td>
                  <td>{transaction.direction === -1 ? transaction.amountForeign : ''}</td>
                  <td>{transaction.direction === 1 ? transaction.amountForeign : ''}</td>
                  <td>{transaction.balanceForeign.toFixed(2)}</td>
                  <td>{transaction.direction === -1 ? transaction.amountNis : ''}</td>
                  <td>{transaction.direction === 1 ? transaction.amountNis : ''}</td>
                  <td>{transaction.balanceNis.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </>
      }
    />
  );
};

export const UserTransactions = () => {
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<LedgerEntity[]>([]);
  const [inputValue, setInputValue] = useState<string>(searchParams.get('name') ?? '');
  const [username, setUsername] = useState<string>(inputValue);
  const { getUserTransactions } = useSql();
  const balanceForeign = useRef(0);
  const sumForeignDebit = useRef(0);
  const sumForeignCredit = useRef(0);
  const balanceNis = useRef(0);
  const sumNisDebit = useRef(0);
  const sumNisCredit = useRef(0);

  const modifyLedgerTransaction = useCallback(
    (modifiedArray: ModifiedTransaction[], transaction: LedgerEntity) => {
      let direction: 1 | -1 = 1;
      let amountNis = 0;
      let amountForeign = 0;
      let counterAccount = '';
      if (transaction.credit_account_1 === username) {
        direction = 1;
        amountNis = Number(transaction.credit_amount_1 ?? '0');
        amountForeign = Number(transaction.foreign_credit_amount_1 ?? '0');
      } else if (transaction.credit_account_2 === username) {
        direction = 1;
        amountNis = Number(transaction.credit_amount_2 ?? '0');
        amountForeign = Number(transaction.foreign_credit_amount_2 ?? '0');
      } else if (transaction.debit_account_1 === username) {
        direction = -1;
        amountNis = Number(transaction.debit_amount_1 ?? '0');
        amountForeign = Number(transaction.foreign_debit_amount_1 ?? '0');
      } else if (transaction.debit_account_2 === username) {
        direction = -1;
        amountNis = Number(transaction.debit_amount_2 ?? '0');
        amountForeign = Number(transaction.foreign_debit_amount_2 ?? '0');
      } else {
        return modifiedArray;
      }

      if (direction === 1) {
        counterAccount = transaction.debit_account_1;
        sumForeignCredit.current += amountForeign;
        sumNisCredit.current += amountNis;
      } else if (direction === -1) {
        counterAccount = transaction.credit_account_1;
        sumForeignDebit.current += amountForeign;
        sumNisDebit.current += amountNis;
      }

      balanceForeign.current += amountForeign * direction;
      balanceNis.current += amountNis * direction;

      modifiedArray.push({
        counterAccount,
        hashavshevet_id: transaction.hashavshevet_id,
        date_3: transaction.date_3,
        value_date: transaction.value_date,
        invoice_date: transaction.invoice_date,
        reference_1: transaction.reference_1,
        reference_2: transaction.reference_2,
        details: transaction.details,
        movement_type: transaction.movement_type,
        currency: transaction.currency,
        direction,
        amountForeign,
        amountNis,
        balanceForeign: 0,
        balanceNis: 0,
      });
      return modifiedArray;
    },
    [username]
  );

  const onUsernameChanged: FormEventHandler<HTMLFormElement> = event => {
    setUsername(inputValue);
    if (!inputValue || inputValue === '') {
      setTransactions([]);
    } else {
      getUserTransactions(inputValue).then(setTransactions);
    }
    event.preventDefault();
  };

  useEffect(() => {
    if (inputValue && inputValue !== '') {
      getUserTransactions(inputValue).then(setTransactions);
    }
  }, [getUserTransactions, inputValue]);

  // on transactions change, modify new data
  const modifiedTransactions = useMemo(
    () => transactions.reduce(modifyLedgerTransaction, []),
    [transactions, modifyLedgerTransaction]
  );

  return (
    <>
      <form onSubmit={onUsernameChanged}>
        <label>
          User Name:
          <input type="text" value={inputValue} onChange={event => setInputValue(event.target.value)} />
        </label>
        <input type="submit" value="Search" />
      </form>

      <h1>User [{username}] Transactions Card</h1>

      <TransactionTable transactions={modifiedTransactions} />

      <h2>User Card Totals</h2>
      <AccounterBasicTable
        content={
          <>
            <thead>
              <tr>
                <th colSpan={2}>מט&quot;ח</th>
                <th colSpan={2}>שקל</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{sumForeignDebit.current.toFixed(2)}</td>
                <td>חובה</td>
                <td>{sumNisDebit.current.toFixed(2)}</td>
                <td>חובה</td>
              </tr>
              <tr>
                <td>{sumForeignCredit.current.toFixed(2)}</td>
                <td>זכות</td>
                <td>{sumNisCredit.current.toFixed(2)}</td>
                <td>זכות</td>
              </tr>
              <tr>
                <td>{balanceForeign.current.toFixed(2)}</td>
                <td>הפרש</td>
                <td>{balanceNis.current.toFixed(2)}</td>
                <td>הפרש</td>
              </tr>
            </tbody>
          </>
        }
      />
    </>
  );
};
