import { useEffect, useState } from 'react';
import { currencyCodeToSymbol } from '../../helpers/currency';
import { useSql } from '../../hooks/useSql';
import { MissingInvoice } from '../../models/types';
import { AccounterBasicTable } from '../common/AccounterBasicTable';
import { AccounterTable } from '../common/AccounterTable';

interface Props {
  monthTaxReport: string;
}

export const MissingInvoiceImages = ({ monthTaxReport }: Props) => {
  const { getMissingInvoiceImages } = useSql();
  const [missingInvoiceImages, setMissingInvoiceImages] = useState<MissingInvoice[]>([]);

  useEffect(() => {
    getMissingInvoiceImages(monthTaxReport).then(setMissingInvoiceImages);
  }, []);

  return (
    <AccounterBasicTable
      content={
        <>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Entity</th>
            <th>Description</th>
            <th>Invoice Number</th>
          </tr>
          <tbody>
            {missingInvoiceImages.map((row, i) => (
              <tr key={i}>
                <td>{new Date(row.event_date).toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
                <td>
                  {row.event_amount}${currencyCodeToSymbol(row.currency_code)}
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
