import type {
  LastInvoiceNumber,
  MissingInvoice,
  MonthTaxReport,
  ProfitRowType,
  ThisMonthPrivateExpensesType,
  TransactionType,
  VatTransaction,
} from '../models/types';

export const useSql = () => {
  const onGetLastInvoiceNumbers = () => {
    //   SELECT tax_invoice_number,
    //     user_description,
    //     financial_entity,
    //     event_amount,
    //     event_date
    //   FROM accounter_schema.all_transactions
    //   WHERE
    //     (account_number in ('466803', '1074', '1082')) AND
    //     event_amount > 0 AND
    //     (financial_entity not in ('Poalim', 'VAT') OR financial_entity IS NULL)
    //   ORDER BY event_date DESC;

    // TODO: fetch last invoices data from DB
    const lastInvoiceNumbers: LastInvoiceNumber[] = [];

    return lastInvoiceNumbers;
  };

  const onGetMissingInvoiceDates = (monthTaxReport: string) => {
    // /* sql req */
    // pool.query(
    //   `
    //     select *
    //     from missing_invoice_dates($1)
    //     order by event_date;
    //   `,
    //   [`$$${monthTaxReport}$$`]
    // ),

    // TODO: fetch missing invoice dates data from DB
    const missingInvoiceDates: MissingInvoice[] = [];

    return missingInvoiceDates;
  };

  const onGetMissingInvoiceImages = (monthTaxReport: string) => {
    // /* sql req */
    // pool.query(
    //   `
    //     select *
    //     from missing_invoice_images($1)
    //     order by event_date;
    //   `,
    //   [`$$${monthTaxReport}$$`]
    // ),

    // TODO: fetch missing invoice images data from DB
    const missingInvoiceImages: MissingInvoice[] = [];

    return missingInvoiceImages;
  };

  const onGetMissingInvoiceNumbers = (monthTaxReport: string) => {
    // /* sql req */
    // pool.query(
    //   `
    //     select *
    //     from missing_invoice_numbers($1)
    //     order by event_date;
    //   `,
    //   [`$$${monthTaxReport}$$`]
    // )

    // TODO: fetch missing invoice numbers data from DB
    const missingInvoiceNumbers: MissingInvoice[] = [];

    return missingInvoiceNumbers;
  };

  const onGetProfitTable = () => {
    // /* sql req */
    // readFileSync('src/monthlyCharts.sql').toString()

    // TODO: fetch profit data from DB
    const profitRows: ProfitRowType[] = [];

    return profitRows;
  };

  const onGetThisMonthPrivateExpenses = () => {
    // /* sql req */
    // `with transactions_exclude as (
    //   select *
    //   from formatted_merged_tables
    //   where
    //       personal_category <> 'conversion' and
    //       personal_category <> 'investments' and
    //       financial_entity <> 'Isracard' and
    //       financial_entity <> 'Tax' and
    //       financial_entity <> 'VAT' and
    //       financial_entity <> 'Tax Shuma' and
    //       financial_entity <> 'Tax Corona Grant' and
    //       financial_entity <> 'Uri Goldshtein' and
    //       financial_entity <> 'Uri Goldshtein Hoz' and
    //       financial_entity <> 'Social Security Deductions' and
    //       financial_entity <> 'Tax Deductions' and
    //       financial_entity <> 'Dotan Simha' and
    //       personal_category <> 'business'
    // )
    // select
    //   personal_category,
    //   sum(event_amount_in_usd_with_vat_if_exists)::float4 as overall_sum
    // from transactions_exclude
    // where
    // event_date::text::date >= '2021-08-01'::text::date and
    // event_date::text::date <= '2021-08-31'::text::date
    // --   and personal_category = 'family'
    // group by personal_category
    // order by sum(event_amount_in_usd_with_vat_if_exists);`;

    // TODO: fetch this month's private expenses data from DB
    const thisMonthPrivateExpenses: ThisMonthPrivateExpensesType[] = [];

    return thisMonthPrivateExpenses;
  };

  const onGetVatTransactions = (monthTaxReport: string) => {
    // /* sql req */
    // pool.query(
    //   `
    //     select *
    //     from get_vat_for_month($1);
    //   `,
    //   [`$$${monthTaxReport}$$`]
    // ),

    // TODO: fetch vat transactions data from DB
    const vatTransactions: VatTransaction[] = [];

    return vatTransactions;
  };

  const onGetAllTransactions = () => {
    // /* sql req */
    // pool.query(`
    //       select *
    //       from accounter_schema.all_transactions
    //       -- where account_number in ('466803', '1074', '1082')
    //       order by event_date desc
    //       limit 2550;
    //     `)

    // TODO: fetch all transactions data from DB
    const allTransactions: TransactionType[] = [];

    return allTransactions;
  };

  const onGetMonthlyTaxesReport = (monthTaxReport: string) => {
    // /* sql req */
    // await pool.query(`
    // select *
    // from get_tax_report_of_month($monthTaxReportDate);
    // `, [
    //   `$$${monthTaxReportDate}$$`,
    // ]);

    // TODO: fetch data from DB
    const monthlyTaxesReport: MonthTaxReport[] = [];

    return monthlyTaxesReport;
  };

  return {
    getLastInvoiceNumbers: () => onGetLastInvoiceNumbers(),
    getMissingInvoiceDates: (monthTaxReport: string) =>
      onGetMissingInvoiceDates(monthTaxReport),
    getMissingInvoiceImages: (monthTaxReport: string) =>
      onGetMissingInvoiceImages(monthTaxReport),
    getMissingInvoiceNumbers: (monthTaxReport: string) =>
      onGetMissingInvoiceNumbers(monthTaxReport),
    getProfitTable: () => onGetProfitTable(),
    getThisMonthPrivateExpenses: () => onGetThisMonthPrivateExpenses(),
    getVatTransactions: (monthTaxReport: string) =>
      onGetVatTransactions(monthTaxReport),
    getAllTransactions: () => onGetAllTransactions(),
    getMonthlyTaxesReport: (monthTaxReport: string) =>
      onGetMonthlyTaxesReport(monthTaxReport),
  };
};
