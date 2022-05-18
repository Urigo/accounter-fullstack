import { FC, FormEventHandler, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSql } from '../hooks/useSql';
import type { LedgerEntity } from '../models/types';

interface ModifiedTransaction {
  counterAccount: string;
  hashavshevet_id?: string;
  תאריך_3?: string;
  תאריך_ערך?: string;
  תאריך_חשבונית?: string;
  אסמכתא_1?: string;
  אסמכתא_2?: string;
  פרטים: string;
  סוג_תנועה?: string;
  מטבע?: string;
  direction: -1 | 1;
  amountForeign: number;
  amountNis: number;
  balanceForeign: number;
  balanceNis: number;
}

const TransactionTable: FC<{ transactions: ModifiedTransaction[] }> = ({ transactions }) => {
  const [balanceForeign, setBalanceForeign] = useState(0);
  const [balanceNis, setBalanceNis] = useState(0);

  return (
    <table>
      <thead>
        <tr>
          <th>ח"ן</th>
          <th>חשבשבת#</th>
          <th>תאריך_3</th>
          <th>תאריך_ ערך</th>
          <th>תאריך_חשבונית</th>
          <th>אסמכתא_1</th>
          <th>אסמכתא_2</th>
          <th>פרטים</th>
          <th>סוג_תנועה</th>
          <th>מטבע</th>
          <th colSpan={2}>חובה/זכות (מט"ח)</th>
          <th>יתרה (מט"ח)</th>
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
            <tr>
              <td>{transaction.counterAccount}</td>
              <td>{transaction.hashavshevet_id ?? ''}</td>
              <td>{transaction.תאריך_3 ?? ''}</td>
              <td>{transaction.תאריך_ערך ? transaction.תאריך_ערך : ''}</td>
              <td>{transaction.תאריך_חשבונית ? transaction.תאריך_חשבונית : ''}</td>
              <td>{transaction.אסמכתא_1 ? transaction.אסמכתא_1 : ''}</td>
              <td>{transaction.אסמכתא_2 ? transaction.אסמכתא_2 : ''}</td>
              <td>{transaction.פרטים === '0' ? '' : transaction.פרטים}</td>
              <td>{transaction.סוג_תנועה ? transaction.סוג_תנועה : ''}</td>
              <td>{transaction.מטבע ? transaction.מטבע : ''}</td>
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
    </table>
  );
};

export const UserTransactions: FC = () => {
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<LedgerEntity[]>([]);
  const [inputValue, setInputValue] = useState<string>(searchParams.get('name') ?? '');
  const [username, setUsername] = useState<string>(inputValue);
  const { getUserTransactions } = useSql();
  let balanceForeign: number = 0;
  let sumForeignDebit: number = 0;
  let sumForeignCredit: number = 0;
  let balanceNis: number = 0;
  let sumNisDebit: number = 0;
  let sumNisCredit: number = 0;

  function modifyLedgerTransaction(modifiedArray: ModifiedTransaction[], transaction: LedgerEntity) {
    let direction: 1 | -1 = 1;
    let amountNis: number = 0;
    let amountForeign: number = 0;
    let counterAccount: string = '';
    if (transaction.חשבון_זכות_1 === username) {
      direction = 1;
      amountNis = transaction.סכום_זכות_1 ? (amountNis = Number(transaction.סכום_זכות_1)) : 0;
      amountForeign = transaction.מטח_סכום_זכות_1 ? Number(transaction.מטח_סכום_זכות_1) : 0;
    } else if (transaction.חשבון_זכות_2 === username) {
      direction = 1;
      amountNis = transaction.סכום_זכות_2 ? (amountNis = Number(transaction.סכום_זכות_2)) : 0;
      amountForeign = transaction.מטח_סכום_זכות_2 ? Number(transaction.מטח_סכום_זכות_2) : 0;
    } else if (transaction.חשבון_חובה_1 === username) {
      direction = -1;
      amountNis = transaction.סכום_חובה_1 ? (amountNis = Number(transaction.סכום_חובה_1)) : 0;
      amountForeign = transaction.מטח_סכום_חובה_1 ? Number(transaction.מטח_סכום_חובה_1) : 0;
    } else if (transaction.חשבון_חובה_2 === username) {
      direction = -1;
      amountNis = transaction.סכום_חובה_2 ? (amountNis = Number(transaction.סכום_חובה_2)) : 0;
      amountForeign = transaction.מטח_סכום_חובה_2 ? Number(transaction.מטח_סכום_חובה_2) : 0;
    } else {
      return modifiedArray;
    }

    if (direction === 1) {
      counterAccount = transaction.חשבון_חובה_1;
      sumForeignCredit += amountForeign;
      sumNisCredit += amountNis;
    } else if (direction === -1) {
      counterAccount = transaction.חשבון_זכות_1;
      sumForeignDebit += amountForeign;
      sumNisDebit += amountNis;
    }

    balanceForeign += amountForeign * direction;
    balanceNis += amountNis * direction;

    modifiedArray.push({
      counterAccount,
      hashavshevet_id: transaction.hashavshevet_id,
      תאריך_3: transaction.תאריך_3,
      תאריך_ערך: transaction.תאריך_ערך,
      תאריך_חשבונית: transaction.תאריך_חשבונית,
      אסמכתא_1: transaction.אסמכתא_1,
      אסמכתא_2: transaction.אסמכתא_2,
      פרטים: transaction.פרטים,
      סוג_תנועה: transaction.סוג_תנועה,
      מטבע: transaction.מטבע,
      direction,
      amountForeign,
      amountNis,
      balanceForeign: 0,
      balanceNis: 0,
    });
    return modifiedArray;
  }

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
  }, []);

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
      <table>
        <thead>
          <tr>
            <th colSpan={2}>מט"ח</th>
            <th colSpan={2}>שקל</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{sumForeignDebit.toFixed(2)}</td>
            <td>חובה</td>
            <td>{sumNisDebit.toFixed(2)}</td>
            <td>חובה</td>
          </tr>
          <tr>
            <td>{sumForeignCredit.toFixed(2)}</td>
            <td>זכות</td>
            <td>{sumNisCredit.toFixed(2)}</td>
            <td>זכות</td>
          </tr>
          <tr>
            <td>{balanceForeign.toFixed(2)}</td>
            <td>הפרש</td>
            <td>{balanceNis.toFixed(2)}</td>
            <td>הפרש</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};
