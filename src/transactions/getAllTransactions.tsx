import * as React from 'react';
import * as ReactDOM from 'react-dom/server';
import { pool } from '..';

export interface AllTransactionsEntity {
  tax_invoice_date: Date | null;
  tax_category: string | null;
  currency_code: string;
  event_date: Date;
  debit_date: Date | null;
  event_amount: string;
  financial_entity: string | null;
  vat: number | null;
  user_description: string | null;
  tax_invoice_number: string | null;
  tax_invoice_amount: number | null;
  receipt_number: number | null;
  business_trip: string | null;
  personal_category: string | null;
  financial_accounts_to_balance: string | null;
  bank_reference: string | null;
  event_number: string | null;
  account_number: number;
  account_type: string;
  is_conversion: boolean;
  currency_rate: number;
  contra_currency_code: number | null;
  bank_description: string;
  withholding_tax: number | null;
  interest: number | null;
  proforma_invoice_file: string | null;
  original_id: string;
  id: string;
  reviewed: boolean | null;
  hashavshevet_id: number | null;
  current_balance: number;
  tax_invoice_file: string | null;
  detailed_bank_description: string;
  links: any | null;
  receipt_image: string | null;
  receipt_url: string | null;
  receipt_date: string | null;
}

export const getAllTransactions = async (): Promise<string> => {
  const res = await pool.query<AllTransactionsEntity>(
    `select * from accounter_schema.all_transactions`
  );

  const pageLength = 200;
  const transactions = res.rows
    ? res.rows.length > pageLength
      ? res.rows.slice(0, pageLength)
      : res.rows
    : [];

  try {
    const content = ReactDOM.renderToString(
      <table>
        {transactions.length && (
          <>
            <thead>
              <tr>
                {Object.keys(transactions[0]).map((key) => (
                  <th>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((row) => (
                <tr>
                  {Object.keys(transactions[0]).map((key) => {
                    let field = row[key as keyof AllTransactionsEntity];
                    return (
                      <td>
                        {typeof field === 'string' ? field : field?.toString()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </>
        )}
      </table>
    );

    return content;
  } catch (error) {
    console.error(`Failed to compile React:`, error);

    throw error;
  }
};
