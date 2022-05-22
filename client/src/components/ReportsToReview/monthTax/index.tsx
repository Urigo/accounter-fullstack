import { MonthTaxRow } from './MonthTaxRow';

export interface MonthIncomeTransaction {
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

interface Props {
  monthIncomeTransactions: MonthIncomeTransaction[];
}

export function MonthTax({ monthIncomeTransactions }: Props) {
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
        {monthIncomeTransactions.map((row, i) => (
          <MonthTaxRow key={i} row={row} />
        ))}
      </tbody>
    </table>
  );
}
