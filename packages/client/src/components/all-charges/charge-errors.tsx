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

export function isAllChargesErrorsFieldsFragmentReady(
  data?: object | FragmentOf<typeof AllChargesErrorsFieldsFragmentDoc>,
): data is FragmentOf<typeof AllChargesErrorsFieldsFragmentDoc> {
  if (!!data && 'errorsLedger' in data) {
    return true;
  }
  return false;
}

interface Props {
  data: FragmentOf<typeof AllChargesErrorsFieldsFragmentDoc>;
}

export const ChargeErrors = ({ data }: Props): ReactElement | null => {
  const charge = readFragment(AllChargesErrorsFieldsFragmentDoc, data);

  return charge &&
    'errorsLedger' in charge &&
    'validate' in charge.errorsLedger &&
    'errors' in charge.errorsLedger.validate &&
    charge.errorsLedger.validate.errors.length ? (
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
