import { FC, useEffect, useState } from 'react';
import { currencyCodeToSymbol } from '../../helpers/currency';
import { useSql } from '../../hooks/useSql';
import type { MissingInvoice } from '../../models/types';

const MissingInvoiceNumberRow: FC<{ data: MissingInvoice }> = ({ data }) => {
  return (
    <tr>
      <td>
        {new Date(data.event_date)
          .toISOString()
          .replace(/T/, ' ')
          .replace(/\..+/, '')}
      </td>
      <td>
        {data.event_amount}
        {currencyCodeToSymbol(data.currency_code)}
      </td>
      <td>{data.financial_entity}</td>
      <td>{data.user_description}</td>
      <td>{data.tax_invoice_number}</td>
    </tr>
  );
};

export const MissingInvoiceNumbers: FC<{ monthTaxReport: string }> = ({
  monthTaxReport,
}) => {
  const { getMissingInvoiceNumbers } = useSql();
  const [missingInvoiceNumbers, setMissingInvoiceNumbers] = useState<
    MissingInvoice[]
  >([]);

  useEffect(() => {
    getMissingInvoiceNumbers(monthTaxReport).then(setMissingInvoiceNumbers);
  }, []);

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
        {missingInvoiceNumbers.map((row, i) => (
          <MissingInvoiceNumberRow key={i} data={row} />
        ))}
      </tbody>
    </table>
  );
};
