import { ReactElement } from 'react';
import { Grid, List, Paper, Table, Text } from '@mantine/core';
import { BusinessTripReportSummaryFieldsFragmentDoc, Currency } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { currencyCodeToSymbol } from '../../../../helpers/currency.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportSummaryFields on BusinessTrip {
    id
    ... on BusinessTrip @defer {
      summary {
        excessExpenditure {
          formatted
        }
        excessTax
        rows {
          type
          totalForeignCurrency {
            formatted
          }
          totalLocalCurrency {
            formatted
          }
          taxableForeignCurrency {
            formatted
          }
          taxableLocalCurrency {
            formatted
          }
          maxTaxableForeignCurrency {
            formatted
          }
          maxTaxableLocalCurrency {
            formatted
          }
          excessExpenditure {
            formatted
          }
        }
        errors
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

  if (!summary) {
    return <Text>Loading...</Text>;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      {summary.errors?.length && (
        <Paper shadow="xs" p="md">
          <Text c="red">Errors:</Text>
          <List size="sm" withPadding>
            {summary.errors.map((error, i) => (
              <List.Item key={i}>
                <Text c="red">{error}</Text>
              </List.Item>
            ))}
          </List>
        </Paper>
      )}
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <th>Expense Type</th>
            <th>Total {currencyCodeToSymbol(Currency.Usd)}</th>
            <th>Total {currencyCodeToSymbol(Currency.Ils)}</th>

            <th>Max Taxable {currencyCodeToSymbol(Currency.Usd)}</th>
            <th>Taxable {currencyCodeToSymbol(Currency.Usd)}</th>
            <th>Taxable {currencyCodeToSymbol(Currency.Ils)}</th>
            <th>Excess Expenditure</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map(row => (
            <tr key={row.type}>
              <td>{normalizeSnakeCase(row.type)}</td>
              <td>{row.totalForeignCurrency?.formatted}</td>
              <td>{row.totalLocalCurrency?.formatted}</td>
              <td>{row.maxTaxableForeignCurrency?.formatted}</td>
              <td>{row.taxableForeignCurrency?.formatted}</td>
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
