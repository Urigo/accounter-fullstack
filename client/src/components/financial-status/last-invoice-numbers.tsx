import { useEffect, useState } from 'react';
import { useSql } from '../../hooks/use-sql';
import type { LastInvoiceNumber } from '../../models/types';
import { AccounterBasicTable } from '../common/accounter-basic-table';

export const LastInvoiceNumbers = () => {
  const { getLastInvoiceNumbers } = useSql();
  const [lastInvoiceNumbers, setLastInvoiceNumbers] = useState<LastInvoiceNumber[]>([]);

  useEffect(() => {
    getLastInvoiceNumbers().then(setLastInvoiceNumbers);
  }, [getLastInvoiceNumbers]);

  return (
    <AccounterBasicTable
      content={
        <>
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
            {lastInvoiceNumbers.map((row, i) => (
              <tr key={i}>
                <td>{row.tax_invoice_number}</td>
                <td>{new Date(row.event_date).toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
                <td>{row.financial_entity}</td>
                <td>{row.user_description}</td>
                <td>{row.event_amount}</td>
              </tr>
            ))}
          </tbody>
        </>
      }
    />
  );
};
