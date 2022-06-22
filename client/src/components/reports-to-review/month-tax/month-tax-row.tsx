import { hashDateFormat } from '../../../helpers';
import { MonthIncomeTransaction } from '.';

interface Props {
  row: MonthIncomeTransaction;
}

export function MonthTaxRow({ row }: Props) {
  return (
    <tr>
      <td>{row.financial_entity}</td>
      <td>{row.tax_invoice_number}</td>
      <td>{hashDateFormat(row.tax_invoice_date)}</td>
      <td>{row.tax_invoice_amount}</td>
      <td>
        {row.event_amount} ${row.currency_code}
      </td>
      <td>{row.vat}</td>
      {/* <td>{stringNumberRounded(getILSForDate(row, invoiceExchangeRates).vatAfterDiductionILS)}</td> */}
      <td>{row.amountBeforeVAT}</td>
      {/* <td>{stringNumberRounded(getILSForDate(row, invoiceExchangeRates).amountBeforeVATILS)}</td> */}
      {/* <td>{stringNumberRounded(getILSForDate(row, invoiceExchangeRates).eventAmountILS)}</td> */}
      {/* <td>{stringNumberRounded(getILSForDate(row, debitExchangeRates).eventAmountILS)}</td> */}
      <td>
        <a href={row.proforma_invoice_file}>P</a>
      </td>
      {/* <td>{numberRounded(incomeSum)}</td> */}
      {/* <td>{numberRounded(VATFreeIncomeSum)}</td> */}
      {/* <td>{numberRounded(VATIncomeSum)}</td> */}
    </tr>
  );
}
