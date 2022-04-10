import { FC } from 'react';
import { currencyCodeToSymbol } from '../../helpers/currency';

interface MissingInvoiceDate {
  event_date: Date;
  event_amount: number;
  currency_code: string;
  financial_entity: string;
  user_description: string;
  tax_invoice_number: number;
}

// /* sql req */
// pool.query(
//   `
//     select *
//     from missing_invoice_dates($1)
//     order by event_date;
//   `,
//   [`$$${monthTaxReport}$$`]
// ),

export const MissingInvoiceDates: FC = () => {
  // TODO: fetch missing invoice dates data from DB
  const missingInvoiceDates: MissingInvoiceDate[] = [];
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Amount</th>
          <th>Entity</th>
          <th>Description</th>
          <th>Invoice Number</th>
        </tr>
      </thead>
      <tbody>
        {missingInvoiceDates.map((row) => (
          <tr>
            <td>
              {row.event_date
                .toISOString()
                .replace(/T/, ' ')
                .replace(/\..+/, '')}
            </td>
            <td>
              {row.event_amount}
              {currencyCodeToSymbol(row.currency_code)}
            </td>
            <td>{row.financial_entity}</td>
            <td>{row.user_description}</td>
            <td>{row.tax_invoice_number}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
