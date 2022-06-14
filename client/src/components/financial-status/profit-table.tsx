import { useEffect, useState } from 'react';
import { formatCurrency } from '../../helpers/currency';
import { useSql } from '../../hooks/use-sql';
import type { ProfitRowType } from '../../models/types';
import { AccounterBasicTable } from '../common/accounter-basic-table';

interface ProfitRowProps {
  data: ProfitRowType;
}

const ProfitRow = ({ data }: ProfitRowProps) => {
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

export const ProfitTable = () => {
  const { getProfitTable } = useSql();
  const [profitRows, setProfitRows] = useState<ProfitRowType[]>([]);

  useEffect(() => {
    getProfitTable().then(setProfitRows);
  }, []);

  return profitRows.length > 0 ? (
    <AccounterBasicTable
      content={
        <>
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
            {profitRows.map((row, i) => (
              <ProfitRow key={i} data={row} />
            ))}
          </tbody>
        </>
      }
    />
  ) : (
    <div />
  );
};
