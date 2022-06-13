import { useEffect, useState } from 'react';
import { currencyCodeToSymbol } from '../../helpers/currency';
import { useSql } from '../../hooks/use-sql';
import type { MissingInvoice } from '../../models/types';
import { AccounterBasicTable } from '../common/accounter-basic-table';

interface Props {
  monthTaxReport: string;
}

export const MissingInvoiceDates = ({ monthTaxReport }: Props) => {
  const { getMissingInvoiceDates } = useSql();
  const [missingInvoiceDates, setMissingInvoiceDates] = useState<MissingInvoice[]>([]);

  useEffect(() => {
    getMissingInvoiceDates(monthTaxReport).then(setMissingInvoiceDates);
  }, []);

  return (
    <AccounterBasicTable
      content={
        <>
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
            {missingInvoiceDates.map((row, i) => (
              <tr key={i}>
                <td>{new Date(row.event_date).toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
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
        </>
      }
    />
  );
};
