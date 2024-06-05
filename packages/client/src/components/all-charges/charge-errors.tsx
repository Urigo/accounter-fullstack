import { ReactElement } from 'react';
import { List, Paper, Text } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../graphql.js';

export const AllChargesErrorsFieldsFragmentDoc = graphql(`
  fragment AllChargesErrorsFields on Charge {
    id
    ... on Charge @defer {
      errorsLedger: ledger {
        ... on Ledger @defer {
          validate(shouldInsertLedgerInNew: false) {
            ... on LedgerValidation @defer {
              errors
            }
          }
        }
      }
    }
  }
`);

interface Props {
  data?: FragmentOf<typeof AllChargesErrorsFieldsFragmentDoc>;
}

export const ChargeErrors = ({ data }: Props): ReactElement | null => {
  const charge = readFragment(AllChargesErrorsFieldsFragmentDoc, data);

  return charge &&
    'errorsLedger' in charge &&
    'validate' in charge.errorsLedger &&
    'errors' in charge.ledger.validate &&
    charge.ledger.validate.errors.length ? (
    <Paper shadow="xs" p="md">
      <Text c="red">Errors:</Text>
      <List size="sm" withPadding>
        {charge.errorsLedger.validate.errors.map((error, i) => (
          <List.Item key={i}>
            <Text c="red">{error}</Text>
          </List.Item>
        ))}
      </List>
    </Paper>
  ) : null;
};
