import { FC } from 'react';
import { formatCurrency } from '../../helpers/currency';

interface ThisMonthPrivateExpensesType {
  personal_category: string;
  overall_sum: number;
}

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

export const ThisMonthPrivateExpensesTable: FC = () => {
  // TODO: fetch this month's private expenses data from DB
  const thisMonthPrivateExpenses: ThisMonthPrivateExpensesType[] = [];

  return thisMonthPrivateExpenses.length > 0 ? (
    <table>
      <thead>
        <tr>
          <th>Personal Category</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {thisMonthPrivateExpenses.map((row) => (
          <tr>
            <td>{row.personal_category}</td>
            <td>{formatCurrency.format(row.overall_sum)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div />
  );
};
