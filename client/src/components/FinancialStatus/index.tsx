import { FC, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseMonth, parseYear } from '../../helpers/dates';
import { AllTransactionsString } from './AllTransactionsString';
import { LastInvoiceNumbers } from './LastInvoiceNumbers';
import { MissingInvoiceDates } from './MissingInvoiceDates';
import { MissingInvoiceImages } from './MissingInvoiceImages';
import { MissingInvoiceNumbers } from './MissingInvoiceNumbers';
import { ProfitTable } from './ProfitTable';
import { ThisMonthPrivateExpensesTable } from './ThisMonthPrivateExpensesTable';
import { VatTransactionsString } from './VatTransactionsString';

export const FinancialStatus = () => {
  const [searchParams] = useSearchParams();

  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const parsedMonth = month ? parseMonth(month) : '08';
  const parsedYear = year ? parseYear(year) : '2021';

  const monthTaxReport = `${parsedYear}-${parsedMonth}-01`;
  console.log('monthTaxReport', monthTaxReport);

  return (
    <>
      <h1>Accounter</h1>
      <a href="/reports-to-review"> Monthly report to review</a>
      <a href="/private-charts"> Private Charts</a>
      <a href="/documents"> Documents</a>
      <ProfitTable />
      <br />
      <ThisMonthPrivateExpensesTable />
      <h3>Missing invoice numbers for a month</h3>
      <MissingInvoiceNumbers monthTaxReport={monthTaxReport} />
      <h3>Missing invoice dates for a month</h3>
      <MissingInvoiceDates monthTaxReport={monthTaxReport} />
      <h3>Missing invoice images</h3>
      <MissingInvoiceImages monthTaxReport={monthTaxReport} />
      <h3>Last invoice numbers</h3>
      <LastInvoiceNumbers />
      <h3>VAT Transactions for this month:</h3>
      <VatTransactionsString monthTaxReport={monthTaxReport} />
      <h3>All Transactions</h3>
      <AllTransactionsString />
    </>
  );
};
