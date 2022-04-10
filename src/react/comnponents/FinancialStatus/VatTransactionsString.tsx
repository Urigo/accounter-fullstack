import { FC } from 'react';

interface VatTransaction {
  overall_vat_status: string;
  vat: number;
  event_date: Date;
  event_amount: number;
  financial_entity: string;
  user_description: string;
}

// /* sql req */
// pool.query(
//   `
//     select *
//     from get_vat_for_month($1);
//   `,
//   [`$$${monthTaxReport}$$`]
// ),

export const VatTransactionsString: FC = () => {
  // TODO: fetch vat transactions data from DB
  const vatTransactions: VatTransaction[] = [];

  return (
    <table>
      <thead>
        <tr>
          <th>Overall VAT Status</th>
          <th>VAT</th>
          <th>Date</th>
          <th>Amount</th>
          <th>Entity</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {vatTransactions.map((row) => (
          <tr>
            <td>{row.overall_vat_status}</td>
            <td>{row.vat}</td>
            <td>
              {row.event_date
                .toISOString()
                .replace(/T/, ' ')
                .replace(/\..+/, '')}
            </td>
            <td>{row.event_amount}</td>
            <td>{row.financial_entity}</td>
            <td>{row.user_description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
