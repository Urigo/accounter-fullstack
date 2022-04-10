import { FC } from 'react';
import { currencyCodeToSymbol } from '../../helpers/currency';

interface MissingInvoiceImages {
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
//     from missing_invoice_images($1)
//     order by event_date;
//   `,
//   [`$$${monthTaxReport}$$`]
// ),

export const MissingInvoiceImages: FC = () => {
  // TODO: fetch missing invoice images data from DB
  const missingInvoiceImages: MissingInvoiceImages[] = [];

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
        {missingInvoiceImages.map((row) => (
          <tr>
            <td>
              {row.event_date
                .toISOString()
                .replace(/T/, ' ')
                .replace(/\..+/, '')}
            </td>
            <td>
              {row.event_amount}${currencyCodeToSymbol(row.currency_code)}
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
