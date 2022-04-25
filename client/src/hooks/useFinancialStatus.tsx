// import { readFileSync } from 'fs';
// import { usePool } from './usePool';

// const lastInvoiceNumbersQuery = `
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
// `;

// function getFulfilledValue<T>(res: PromiseSettledResult<T>) {
//   if (res.status === 'fulfilled') {
//     return res.value;
//   }
//   return undefined;
// }

// export const useFinancialStatus = () => {
//   const { pool } = usePool();

//   const onGetFinancialStatus = async (monthTaxReport: string) => {
//     console.time('callingDB');

//     const results = await Promise.allSettled([
//       pool.query(
//         `
//             select *
//             from missing_invoice_dates($1)
//             order by event_date;
//           `,
//         [`$$${monthTaxReport}$$`]
//       ),
//       pool.query(
//         `
//             select *
//             from missing_invoice_numbers($1)
//             order by event_date;
//           `,
//         [`$$${monthTaxReport}$$`]
//       ),
//       pool.query(lastInvoiceNumbersQuery),
//       // pool.query(currentVATStatusQuery),
//       pool.query(
//         `
//             select *
//             from get_vat_for_month($1);
//           `,
//         [`$$${monthTaxReport}$$`]
//       ),
//       pool.query(`
//           select *
//           from accounter_schema.all_transactions
//           -- where account_number in ('466803', '1074', '1082')
//           order by event_date desc
//           limit 2550;
//         `),
//       pool.query(
//         `
//             select *
//             from missing_invoice_images($1)
//             order by event_date;
//           `,
//         [`$$${monthTaxReport}$$`]
//       ),
//       pool.query(readFileSync('src/monthlyCharts.sql').toString()),
//       pool.query(`
//         with transactions_exclude as (
//           select *
//           from formatted_merged_tables
//           where
//               personal_category <> 'conversion' and
//               personal_category <> 'investments' and
//               financial_entity <> 'Isracard' and
//               financial_entity <> 'Tax' and
//               financial_entity <> 'VAT' and
//               financial_entity <> 'Tax Shuma' and
//               financial_entity <> 'Tax Corona Grant' and
//               financial_entity <> 'Uri Goldshtein' and
//               financial_entity <> 'Uri Goldshtein Hoz' and
//               financial_entity <> 'Social Security Deductions' and
//               financial_entity <> 'Tax Deductions' and
//               financial_entity <> 'Dotan Simha' and
//               personal_category <> 'business'
//       )
//       select
//           personal_category,
//           sum(event_amount_in_usd_with_vat_if_exists)::float4 as overall_sum
//       from transactions_exclude
//       where
//         event_date::text::date >= '2021-08-01'::text::date and
//         event_date::text::date <= '2021-08-31'::text::date
//       --   and personal_category = 'family'
//       group by personal_category
//       order by sum(event_amount_in_usd_with_vat_if_exists);
//         `),
//     ]);

//     console.timeEnd('callingDB');

//     return {
//       missingInvoiceDates: getFulfilledValue(results[0]),
//       missingInvoiceNumbers: getFulfilledValue(results[1]),
//       lastInvoiceNumbers: getFulfilledValue(results[2]),
//       // currentVATStatus: getFulfilledValue(results[3]),
//       VATTransactions: getFulfilledValue(results[3]),
//       allTransactions: getFulfilledValue(results[4]),
//       missingInvoiceImages: getFulfilledValue(results[5]),
//       profitTable: getFulfilledValue(results[6]),
//       thisMonthPrivateExpensesTable: getFulfilledValue(results[7]),
//     };
//   };

//   return {
//     getFinancialStatus: async (monthTaxReport: string) => {
//       return await onGetFinancialStatus(monthTaxReport);
//     },
//   };
// };
