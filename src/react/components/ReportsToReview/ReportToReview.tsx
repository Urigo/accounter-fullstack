import { FC, useState, ReactElement } from 'react';
import { useSql } from '../../hooks/useSql';
import type { LedgerEntity } from '../../models/types';
import { HoverHandler } from '../common/HoverHandler';

const EditElement: FC<{
  transaction: LedgerEntity;
  attribute: keyof LedgerEntity;
}> = ({ transaction, attribute }) => {
  const { updateBankTransactionAttribute } = useSql();
  const defaultValue =
    typeof transaction[attribute] === 'boolean'
      ? transaction[attribute].toString()
      : (transaction[attribute] as string);
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="editor">
      <input
        type="text"
        defaultValue={defaultValue}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <br />
      <button
        onClick={() =>
          updateBankTransactionAttribute({
            transactionId: transaction.id,
            attribute,
            value,
          })
        }
      >
        Execute
      </button>
    </div>
  );
};

const TransactionRow: FC<{
  transaction: LedgerEntity;
  index: number;
  setSelected: (id: string) => void;
  isSelected: boolean;
}> = ({ transaction, index, setSelected, isSelected }) => {
  const { generateTaxMovement, deleteTaxMovement, reviewTransaction } =
    useSql();

  const generateGoToUserTransactionsFunctionCall = (
    userName?: string | null
  ) => {
    if (!userName) {
      return;
    }
    return <a href={`/user-transactions?name=${userName}`}>{userName}</a>;
  };
  const movementOrBank = transaction.פרטים && transaction.פרטים == '0';
  const addHoverEditButton = (
    attribute: keyof LedgerEntity,
    viewableHtml?: JSX.Element
  ) => {
    const content = viewableHtml || (transaction[attribute] as string) || '';

    if (movementOrBank) {
      return content;
    }

    return (
      <HoverHandler
        hoverElement={
          <EditElement transaction={transaction} attribute={attribute} />
        }
      >
        {content}
      </HoverHandler>
    );
  };
  const missingHashavshevetSync =
    (movementOrBank &&
      !transaction.hashavshevet_id &&
      transaction.חשבון_חובה_1 != 'כא') ||
    (!movementOrBank && !transaction.hashavshevet_id);

  return (
    <tr
      className={movementOrBank ? 'bank-transaction' : undefined}
      onClick={() => setSelected(transaction.id)}
      style={isSelected ? { backgroundColor: 'coral' } : undefined}
    >
      <td>{index}</td>
      <td>
        <input
          onChange={(e) => {
            reviewTransaction({
              id: transaction.id,
              accountType: movementOrBank
                ? transaction.חשבון_חובה_1
                : undefined,
              reviewed: e.target.checked,
            });
          }}
          type="checkbox"
          id={transaction.id}
          defaultChecked={transaction.reviewed}
        />
      </td>
      <td className="invoiceDate">
        {addHoverEditButton('תאריך_חשבונית')}
        <img className="invoiceImage" src={transaction.proforma_invoice_file} />
      </td>
      <td>
        {addHoverEditButton(
          'חשבון_חובה_1',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_חובה_1)
        )}
      </td>
      <td>{addHoverEditButton('סכום_חובה_1')}</td>
      <td>{addHoverEditButton('מטח_סכום_חובה_1')}</td>
      <td>{addHoverEditButton('מטבע')}</td>
      <td>
        {addHoverEditButton(
          'חשבון_זכות_1',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_זכות_1)
        )}
      </td>
      <td>{addHoverEditButton('סכום_זכות_1')}</td>
      <td>{addHoverEditButton('מטח_סכום_זכות_1')}</td>
      <td>
        {addHoverEditButton(
          'חשבון_חובה_2',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_חובה_2)
        )}
      </td>
      <td>{addHoverEditButton('סכום_חובה_2')}</td>
      <td>{addHoverEditButton('מטח_סכום_חובה_2')}</td>
      <td>
        {addHoverEditButton(
          'חשבון_זכות_2',
          generateGoToUserTransactionsFunctionCall(transaction.חשבון_זכות_2)
        )}
      </td>
      <td>{addHoverEditButton('סכום_זכות_2')}</td>
      <td>{addHoverEditButton('מטח_סכום_זכות_2')}</td>
      <td>{addHoverEditButton('פרטים')}</td>
      <td>{addHoverEditButton('אסמכתא_1')}</td>
      <td>{addHoverEditButton('אסמכתא_2')}</td>
      <td>{addHoverEditButton('סוג_תנועה')}</td>
      <td className="valueDate">
        {addHoverEditButton('תאריך_ערך')}
      </td>
      <td>{addHoverEditButton('תאריך_3')}</td>
      <td
        style={
          missingHashavshevetSync
            ? { backgroundColor: 'rgb(255,0,0)' }
            : undefined
        }
      >
        {transaction.hashavshevet_id ? transaction.hashavshevet_id : ''}
        <button
          type="button"
          onClick={() => {
            if (movementOrBank) {
              generateTaxMovement(transaction.id);
            } else {
              //TODO: what is sendToHashavshevet?
              // sendToHashavshevet(transaction.id);
            }
          }}
        >
          e
        </button>
        {movementOrBank && (
          <button
            type="button"
            onClick={() => deleteTaxMovement(transaction.id)}
          >
            D
          </button>
        )}
      </td>
    </tr>
  );
};

export const ReportToReview: FC<{
  reportMonthToReview: string;
  currrentCompany: string;
}> = ({ reportMonthToReview, currrentCompany }) => {
  const { getReportToReview } = useSql();
  const [selectedRow, setSelectedRow] = useState<string | undefined>(undefined);

  const transactions: LedgerEntity[] =
    getReportToReview(currrentCompany, reportMonthToReview) ?? [];

  const [incomeSum, outcomeSum, VATincome, VAToutcome] = transactions.reduce(
    ([income, outcome, vatIn, vatOut], transaction) => {
      if (
        transaction.חשבון_חובה_1 != 'מעמחוז' &&
        transaction.חשבון_חובה_1 != 'עסק' &&
        transaction.פרטים &&
        transaction.פרטים != '0'
      ) {
        if (transaction.סכום_חובה_1) {
          outcome += parseFloat(transaction.סכום_חובה_1);
        }
        if (transaction.סכום_חובה_2) {
          outcome += parseFloat(transaction.סכום_חובה_2);
        }
        if (transaction.סכום_זכות_1) {
          income += parseFloat(transaction.סכום_זכות_1);
        }
        if (transaction.סכום_זכות_2) {
          income += parseFloat(transaction.סכום_זכות_2);
        }

        if (transaction.סכום_זכות_2) {
          vatIn += parseFloat(transaction.סכום_זכות_2);
        }
        if (transaction.סכום_חובה_2) {
          vatOut += parseFloat(transaction.סכום_חובה_2);
        }
      }
      return [income, outcome, vatIn, vatOut];
    },
    [0, 0, 0, 0]
  );

  return (
    <>
      <div>
        סהכ סכום חובה : <br />
        {(Math.round(outcomeSum * 100) / 100).toFixed(2)}
      </div>
      <div>
        סהכ סכום זכות : <br />
        {(Math.round(incomeSum * 100) / 100).toFixed(2)}
      </div>

      <div>
        2סהכ חובה : <br />
        {(Math.round(VAToutcome * 100) / 100).toFixed(2)}
      </div>
      <div>
        2סהכ זכות : <br />
        {(Math.round(VATincome * 100) / 100).toFixed(2)}
      </div>
      <table>
        <thead>
          <tr>
            <th>מספר</th>
            <th>תקין</th>
            <th>תאריך_חשבונית</th>
            <th>חשבון_חובה_1</th>
            <th>סכום_חובה_1</th>
            <th>מטח_סכום_חובה_1</th>
            <th>מטבע</th>
            <th>חשבון_זכות_1</th>
            <th>סכום_זכות_1</th>
            <th>מטח_סכום_זכות_1</th>
            <th>חשבון_חובה_2</th>
            <th>סכום_חובה_2</th>
            <th>מטח_סכום_חובה_2</th>
            <th>חשבון_זכות_2</th>
            <th>סכום_זכות_2</th>
            <th>מטח_סכום_זכות_2</th>
            <th>פרטים</th>
            <th>אסמכתא_1</th>
            <th>אסמכתא_2</th>
            <th>סוג_תנועה</th>
            <th>תאריך_ערך</th>
            <th>תאריך_3</th>
            <th>חשבשבת</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, i) => (
            <TransactionRow
              transaction={transaction}
              index={i}
              key={transaction.id}
              isSelected={transaction.id === selectedRow}
              setSelected={setSelectedRow}
            />
          ))}
        </tbody>
      </table>
    </>
  );
};
