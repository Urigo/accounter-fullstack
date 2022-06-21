import { useEffect, useState } from 'react';

import { useSql } from '../../hooks/use-sql';
import type { LedgerEntity } from '../../models/types';
import { AccounterBasicTable } from '../common/accounter-basic-table';
import { HoverHandler } from '../common/hover-handler';

interface EditElementProps {
  transaction: LedgerEntity;
  attribute: keyof LedgerEntity;
}

const EditElement = ({ transaction, attribute }: EditElementProps) => {
  // const { updateBankTransactionAttribute } = useSql();
  const defaultValue =
    typeof transaction[attribute] === 'boolean'
      ? transaction[attribute].toString()
      : (transaction[attribute] as string);
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="editor">
      <input type="text" defaultValue={defaultValue} value={value} onChange={e => setValue(e.target.value)} />
      <br />
      {/* TODO: Cannot use updateBankTransactionAttribute to update ledger */}
      {/* <button
        onClick={() =>
          updateBankTransactionAttribute({
            transactionId: transaction.id,
            attribute,
            value,
          })
        }
      >
        Execute
      </button> */}
    </div>
  );
};

interface TransactionRowProps {
  transaction: LedgerEntity;
  index: number;
  setSelected: (id: string) => void;
  isSelected: boolean;
}

const TransactionRow = ({ transaction, index, setSelected, isSelected }: TransactionRowProps) => {
  const { generateTaxMovement, deleteTaxMovement, reviewTransaction } = useSql();

  const generateGoToUserTransactionsFunctionCall = (userName?: string | null) => {
    if (!userName) {
      return;
    }
    return <a href={`/user-transactions?name=${userName}`}>{userName}</a>;
  };
  const movementOrBank = transaction.details && transaction.details == '0';
  const addHoverEditButton = (attribute: keyof LedgerEntity, viewableHtml?: JSX.Element) => {
    const content = viewableHtml || (transaction[attribute] as string) || '';

    if (movementOrBank) {
      return content;
    }

    return (
      <HoverHandler hoverElement={<EditElement transaction={transaction} attribute={attribute} />}>
        {content}
      </HoverHandler>
    );
  };
  const missingHashavshevetSync =
    (movementOrBank && !transaction.hashavshevet_id && transaction.debit_account_1 != 'כא') ||
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
          onChange={e => {
            reviewTransaction({
              id: transaction.id,
              accountType: movementOrBank ? transaction.debit_account_1 : undefined,
              reviewed: e.target.checked,
            });
          }}
          type="checkbox"
          id={transaction.id}
          defaultChecked={transaction.reviewed}
        />
      </td>
      <td className="invoiceDate">
        {addHoverEditButton('invoice_date')}
        <img className="invoiceImage" src={transaction.proforma_invoice_file} alt="Invoice" />
      </td>
      <td>
        {addHoverEditButton('debit_account_1', generateGoToUserTransactionsFunctionCall(transaction.debit_account_1))}
      </td>
      <td>{addHoverEditButton('debit_amount_1')}</td>
      <td>{addHoverEditButton('foreign_debit_amount_1')}</td>
      <td>{addHoverEditButton('currency')}</td>
      <td>
        {addHoverEditButton('credit_account_1', generateGoToUserTransactionsFunctionCall(transaction.credit_account_1))}
      </td>
      <td>{addHoverEditButton('credit_amount_1')}</td>
      <td>{addHoverEditButton('foreign_credit_amount_1')}</td>
      <td>
        {addHoverEditButton('debit_account_2', generateGoToUserTransactionsFunctionCall(transaction.debit_account_2))}
      </td>
      <td>{addHoverEditButton('debit_amount_2')}</td>
      <td>{addHoverEditButton('foreign_debit_amount_2')}</td>
      <td>
        {addHoverEditButton('credit_account_2', generateGoToUserTransactionsFunctionCall(transaction.credit_account_2))}
      </td>
      <td>{addHoverEditButton('credit_amount_2')}</td>
      <td>{addHoverEditButton('foreign_credit_amount_2')}</td>
      <td>{addHoverEditButton('details')}</td>
      <td>{addHoverEditButton('reference_1')}</td>
      <td>{addHoverEditButton('reference_2')}</td>
      <td>{addHoverEditButton('movement_type')}</td>
      <td className="valueDate">{addHoverEditButton('value_date')}</td>
      <td>{addHoverEditButton('date_3')}</td>
      <td style={missingHashavshevetSync ? { backgroundColor: 'rgb(255,0,0)' } : undefined}>
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
          <button type="button" onClick={() => deleteTaxMovement(transaction.id)}>
            D
          </button>
        )}
      </td>
    </tr>
  );
};

interface ReportToReviewProps {
  reportMonthToReview: string;
  currrentCompany: string;
}

export const ReportToReview = ({ reportMonthToReview, currrentCompany }: ReportToReviewProps) => {
  const { getReportToReview } = useSql();
  const [selectedRow, setSelectedRow] = useState<string | undefined>(undefined);
  const [transactions, setTransactions] = useState<LedgerEntity[]>([]);

  useEffect(() => {
    getReportToReview(currrentCompany, reportMonthToReview).then(setTransactions);
  }, [getReportToReview, currrentCompany, reportMonthToReview]);

  const [incomeSum, outcomeSum, VATincome, VAToutcome] = transactions.reduce(
    ([income, outcome, vatIn, vatOut], transaction) => {
      if (
        transaction.debit_account_1 != 'מעמחוז' &&
        transaction.debit_account_1 != 'עסק' &&
        transaction.details &&
        transaction.details != '0'
      ) {
        if (transaction.debit_amount_1) {
          outcome += parseFloat(transaction.debit_amount_1);
        }
        if (transaction.debit_amount_2) {
          outcome += parseFloat(transaction.debit_amount_2);
        }
        if (transaction.credit_amount_1) {
          income += parseFloat(transaction.credit_amount_1);
        }
        if (transaction.credit_amount_2) {
          income += parseFloat(transaction.credit_amount_2);
        }

        if (transaction.credit_amount_2) {
          vatIn += parseFloat(transaction.credit_amount_2);
        }
        if (transaction.debit_amount_2) {
          vatOut += parseFloat(transaction.debit_amount_2);
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
      <AccounterBasicTable
        content={
          <>
            <thead>
              <tr>
                <th>מספר</th>
                <th>תקין</th>
                <th>invoice_date</th>
                <th>debit_account_1</th>
                <th>debit_amount_1</th>
                <th>foreign_debit_amount_1</th>
                <th>currency</th>
                <th>credit_account_1</th>
                <th>credit_amount_1</th>
                <th>foreign_credit_amount_1</th>
                <th>debit_account_2</th>
                <th>debit_amount_2</th>
                <th>foreign_debit_amount_2</th>
                <th>credit_account_2</th>
                <th>credit_amount_2</th>
                <th>foreign_credit_amount_2</th>
                <th>details</th>
                <th>reference_1</th>
                <th>reference_2</th>
                <th>movement_type</th>
                <th>value_date</th>
                <th>date_3</th>
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
          </>
        }
      />
    </>
  );
};
