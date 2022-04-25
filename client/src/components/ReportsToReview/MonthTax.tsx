import { FC } from 'react';
import { getILSForDate, hashDateFormat } from '../../helpers';
import { numberRounded, stringNumberRounded } from '../../helpers/numbers';

interface MonthIncomeTransaction {
  financial_entity: string;
  tax_invoice_number: string;
  tax_invoice_date: Date;
  tax_invoice_amount: number;
  event_amount: number;
  currency_code: string;
  vat: string;
  vatAfterDiduction: number;
  amountBeforeVAT: number;
  amountBeforeFullVAT: number;
  proforma_invoice_file: string;
}

export const MonthTax: FC<{
  monthIncomeTransactions: MonthIncomeTransaction[];
}> = ({ monthIncomeTransactions }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Invoice Number</th>
          <th>Tax Invoice Date</th>
          <th>Tax Invoice Amount</th>
          <th>Amount</th>
          <th>VAT</th>
          <th>VAT in Shekels</th>
          <th>SUM Before VAT</th>
          <th>SUM Before VAT in Shekels</th>
          <th>In ILS Invoice</th>
          <th>In ILS Debit</th>
          <th>Image</th>
          <th>Sum till now</th>
          <th>VAT Free Sum till now</th>
          <th>VAT Income Sum till now</th>
        </tr>
      </thead>
      <tbody>
        {monthIncomeTransactions.map((row) => (
          <tr>
            <td>{row.financial_entity}</td>
            <td>{row.tax_invoice_number}</td>
            <td>{hashDateFormat(row.tax_invoice_date)}</td>
            <td>{row.tax_invoice_amount}</td>
            <td>
              {row.event_amount} ${row.currency_code}
            </td>
            <td>{row.vat}</td>
            <td>
              {stringNumberRounded(
                getILSForDate(row, invoiceExchangeRates).vatAfterDiductionILS
              )}
            </td>
            <td>{row.amountBeforeVAT}</td>
            <td>
              {stringNumberRounded(
                getILSForDate(row, invoiceExchangeRates).amountBeforeVATILS
              )}
            </td>
            <td>
              {stringNumberRounded(
                getILSForDate(row, invoiceExchangeRates).eventAmountILS
              )}
            </td>
            <td>
              {stringNumberRounded(
                getILSForDate(row, debitExchangeRates).eventAmountILS
              )}
            </td>
            <td>
              <a href={row.proforma_invoice_file}>P</a>
            </td>
            <td>{numberRounded(incomeSum)}</td>
            <td>{numberRounded(VATFreeIncomeSum)}</td>
            <td>{numberRounded(VATIncomeSum)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
