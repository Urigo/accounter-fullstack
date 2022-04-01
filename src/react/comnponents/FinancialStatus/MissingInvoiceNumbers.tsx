import { FC } from 'react';
import { currencyCodeToSymbol } from '../../helpers/currency';

interface MissingInvoiceNumber {
  event_date: Date;
  event_amount: string;
  currency_code: string;
  financial_entity: string;
  user_description: string;
  tax_invoice_number: string;
}

const MissingInvoiceNumberRow: FC<{ data: MissingInvoiceNumber }> = ({
  data,
}) => {
  return (
    <tr>
      <td>
        {data.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}
      </td>
      <td>
        {data.event_amount}
        {currencyCodeToSymbol(data.currency_code)}
      </td>
      <td>{data.financial_entity}</td>
      <td>{data.user_description}</td>
      <td>{data.tax_invoice_number}</td>
    </tr>
  );
};

// /* sql req */
// pool.query(
//   `
//     select *
//     from missing_invoice_numbers($1)
//     order by event_date;
//   `,
//   [`$$${monthTaxReport}$$`]
// )

export const MissingInvoiceNumbers: FC = () => {
  // TODO: fetch missing invoice numbers data from DB
  const missingInvoiceNumbers: MissingInvoiceNumber[] = [];

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
        {missingInvoiceNumbers.map((row) => (
          <MissingInvoiceNumberRow data={row} />
        ))}
      </tbody>
    </table>
  );
};
