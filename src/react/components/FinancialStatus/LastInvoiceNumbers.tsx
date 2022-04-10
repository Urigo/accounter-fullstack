import { FC } from 'react';

interface LastInvoiceNumber {
  tax_invoice_number: number;
  event_date: Date;
  financial_entity: string;
  user_description: string;
  event_amount: number;
}

// /* sql req */
// export const lastInvoiceNumbersQuery = `
//   SELECT tax_invoice_number,
//     user_description,
//     financial_entity,
//     event_amount,
//     event_date
//   FROM accounter_schema.all_transactions
//   WHERE
//     (account_number in ('466803', '1074', '1082')) AND
//     event_amount > 0 AND
//     (financial_entity not in ('Poalim', 'VAT') OR financial_entity IS NULL)
//   ORDER BY event_date DESC;
// `;

export const LastInvoiceNumbers: FC = () => {
  // TODO: fetch last invoices data from DB
  const lastInvoiceNumbers: LastInvoiceNumber[] = [];

  return (
    <table>
      <thead>
        <tr>
          <th>Invoice Number</th>
          <th>Date</th>
          <th>Entity</th>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {lastInvoiceNumbers.map((row) => (
          <tr>
            <td>{row.tax_invoice_number}</td>
            <td>
              {row.event_date
                .toISOString()
                .replace(/T/, ' ')
                .replace(/\..+/, '')}
            </td>
            <td>{row.financial_entity}</td>
            <td>{row.user_description}</td>
            <td>{row.event_amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
