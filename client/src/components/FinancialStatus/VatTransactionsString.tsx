import { FC, useEffect, useState } from 'react';
import { useSql } from '../../hooks/useSql';
import type { VatTransaction } from '../../models/types';

export const VatTransactionsString: FC<{ monthTaxReport: string }> = ({
  monthTaxReport,
}) => {
  const { getVatTransactions } = useSql();
  const [vatTransactions, setVatTransactions] = useState<VatTransaction[]>([]);

  useEffect(() => {
    getVatTransactions(monthTaxReport).then(setVatTransactions);
  }, []);

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
        {vatTransactions.map((row, i) => (
          <tr key={i}>
            <td>{row.overall_vat_status}</td>
            <td>{row.vat}</td>
            <td>
              {new Date(row.event_date)
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
