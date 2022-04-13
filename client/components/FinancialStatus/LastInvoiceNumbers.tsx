import { FC } from 'react';
import { useSql } from '../../hooks/useSql';

export const LastInvoiceNumbers: FC = () => {
  const { getLastInvoiceNumbers } = useSql();

  const lastInvoiceNumbers = getLastInvoiceNumbers();

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
