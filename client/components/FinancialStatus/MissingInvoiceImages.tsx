import { FC } from 'react';
import { currencyCodeToSymbol } from '../../helpers/currency';
import { useSql } from '../../hooks/useSql';

export const MissingInvoiceImages: FC<{ monthTaxReport: string }> = ({
  monthTaxReport,
}) => {
  const { getMissingInvoiceImages } = useSql();

  const missingInvoiceImages = getMissingInvoiceImages(monthTaxReport);

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
        {missingInvoiceImages.map((row) => (
          <tr>
            <td>
              {row.event_date
                .toISOString()
                .replace(/T/, ' ')
                .replace(/\..+/, '')}
            </td>
            <td>
              {row.event_amount}${currencyCodeToSymbol(row.currency_code)}
            </td>
            <td>{row.financial_entity}</td>
            <td>{row.user_description}</td>
            <td>{row.tax_invoice_number}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
