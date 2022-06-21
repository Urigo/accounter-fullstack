import { useEffect, useState } from 'react';

import { currencyCodeToSymbol } from '../../helpers/currency';
import { useSql } from '../../hooks/use-sql';
import type { MissingInvoice } from '../../models/types';
import { AccounterBasicTable } from '../common/accounter-basic-table';

interface MissingInvoiceNumberRowProps {
  data: MissingInvoice;
}

const MissingInvoiceNumberRow = ({ data }: MissingInvoiceNumberRowProps) => {
  return (
    <tr>
      <td>{new Date(data.event_date).toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
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

interface MissingInvoiceNumbersProps {
  monthTaxReport: string;
}

export const MissingInvoiceNumbers = ({ monthTaxReport }: MissingInvoiceNumbersProps) => {
  const { getMissingInvoiceNumbers } = useSql();
  const [missingInvoiceNumbers, setMissingInvoiceNumbers] = useState<MissingInvoice[]>([]);

  useEffect(() => {
    getMissingInvoiceNumbers(monthTaxReport).then(setMissingInvoiceNumbers);
  }, [getMissingInvoiceNumbers, monthTaxReport]);

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
            {missingInvoiceNumbers.map((row, i) => (
              <MissingInvoiceNumberRow key={i} data={row} />
            ))}
          </tbody>
        </>
      }
    />
  );
};
