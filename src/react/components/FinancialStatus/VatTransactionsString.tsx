import { FC } from 'react';
import { useSql } from '../../hooks/useSql';

export const VatTransactionsString: FC<{ monthTaxReport: string }> = ({
  monthTaxReport,
}) => {
  const { getVatTransactions } = useSql();

  const vatTransactions = getVatTransactions(monthTaxReport);

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
