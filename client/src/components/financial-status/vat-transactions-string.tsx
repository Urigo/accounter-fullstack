import { useEffect, useState } from 'react';

import { useSql } from '../../hooks/use-sql';
import type { VatTransaction } from '../../models/types';
import { AccounterBasicTable } from '../common/accounter-basic-table';

interface Props {
  monthTaxReport: string;
}

export const VatTransactionsString = ({ monthTaxReport }: Props) => {
  const { getVatTransactions } = useSql();
  const [vatTransactions, setVatTransactions] = useState<VatTransaction[]>([]);

  useEffect(() => {
    getVatTransactions(monthTaxReport).then(setVatTransactions);
  }, [getVatTransactions, monthTaxReport]);

  return (
    <AccounterBasicTable
      content={
        <>
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
                <td>{new Date(row.event_date).toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
                <td>{row.event_amount}</td>
                <td>{row.financial_entity}</td>
                <td>{row.user_description}</td>
              </tr>
            ))}
          </tbody>
        </>
      }
    />
  );
};
