import { ReactElement } from 'react';
import { Grid, Table, Text, Title } from '@mantine/core';
import { BusinessTripReportSummaryFieldsFragmentDoc, Currency } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { currencyCodeToSymbol } from '../../../../helpers/currency.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportSummaryFields on BusinessTrip {
    id
    summary {
      excessExpenditure {
        formatted
      }
      excessTax
      rows {
        type
        totalForeignCurrencies {
          currency
          formatted
        }
        totalLocalCurrency {
          formatted
        }
        taxableForeignCurrencies {
          currency
          formatted
        }
        taxableLocalCurrency {
          formatted
        }
        excessExpenditure {
          formatted
        }
      }
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportSummaryFieldsFragmentDoc>;
}

function normalizeSnakeCase(raw: string): string {
  return raw.split('_').map(upperFirst).join(' ');
}

function upperFirst(raw: string): string {
  return raw.slice(0, 1).toUpperCase() + raw.slice(1, raw.length).toLowerCase();
}

export const Summary = ({ data }: Props): ReactElement => {
  const { summary } = getFragmentData(BusinessTripReportSummaryFieldsFragmentDoc, data);

  const foreignCurrencies = Array.from(
    new Set<Currency>(
      summary.rows.flatMap(
        row => row.totalForeignCurrencies?.map(({ currency }) => currency) ?? [],
      ),
    ),
  );

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Title order={5}>Summary</Title>
      <Table>
        <thead>
          <tr>
            <th>Expense Type</th>
            {foreignCurrencies.map(currency => (
              <th key={currency}>Total {currencyCodeToSymbol(currency)}</th>
            ))}
            <th>Total {currencyCodeToSymbol(Currency.Ils)}</th>

            {foreignCurrencies.map(currency => (
              <th key={currency}>Taxable {currencyCodeToSymbol(currency)}</th>
            ))}
            <th>Taxable {currencyCodeToSymbol(Currency.Ils)}</th>
            <th>Excess Expenditure</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map(row => (
            <tr key={row.type}>
              <td>{normalizeSnakeCase(row.type)}</td>
              {foreignCurrencies.map(currency => (
                <td key={currency}>
                  {row.totalForeignCurrencies?.find(({ currency: c }) => c === currency)?.formatted}
                </td>
              ))}
              <td>{row.totalLocalCurrency?.formatted}</td>
              {foreignCurrencies.map(currency => (
                <td key={currency}>
                  {
                    row.taxableForeignCurrencies?.find(({ currency: c }) => c === currency)
                      ?.formatted
                  }
                </td>
              ))}
              <td>{row.taxableLocalCurrency?.formatted}</td>
              <td>{row.excessExpenditure?.formatted}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Grid justify="flex-end">
        <Grid.Col lg={2} md={4}>
          Excess Expenditure Tax:
          <Text fz="lg">{summary.excessTax ?? '0'}%</Text>
        </Grid.Col>
        <Grid.Col lg={2} md={3} className="flex flex-col justify-end">
          <Text fz="lg">{summary.excessExpenditure?.formatted ?? '0.00'}</Text>
        </Grid.Col>
      </Grid>
    </div>
  );
};
