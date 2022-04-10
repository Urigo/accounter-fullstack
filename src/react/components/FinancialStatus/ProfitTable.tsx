import { FC } from 'react';
import { formatCurrency } from '../../helpers/currency';

interface ProfitRowType {
  date: string;
  business_income: number;
  business_expenses: number;
  overall_business_profit: number;
  business_profit_share: number;
  private_expenses: number;
  overall_private: number;
}

const ProfitRow: FC<{ data: ProfitRowType }> = ({ data }) => {
  return (
    <tr>
      <td>{data.date}</td>
      <td>{formatCurrency.format(data.business_income)}</td>
      <td>{formatCurrency.format(data.business_expenses)}</td>
      <td>{formatCurrency.format(data.overall_business_profit)}</td>
      <td>{formatCurrency.format(data.business_profit_share)}</td>
      <td>{formatCurrency.format(data.private_expenses)}</td>
      <td>{formatCurrency.format(data.overall_private)}</td>
    </tr>
  );
};

// /* sql req */
// readFileSync('src/monthlyCharts.sql').toString()

export const ProfitTable: FC = () => {
  // TODO: fetch profit data from DB
  const profitRows: ProfitRowType[] = [];

  return profitRows.length > 0 ? (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Business Income</th>
          <th>Business Expenses</th>
          <th>overall_business_profit</th>
          <th>business_profit_share</th>
          <th>private_expenses</th>
          <th>overall_private</th>
        </tr>
      </thead>
      <tbody>
        {profitRows.map((row) => (
          <ProfitRow data={row} />
        ))}
      </tbody>
    </table>
  ) : (
    <div />
  );
};
