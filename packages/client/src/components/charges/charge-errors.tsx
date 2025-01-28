import { ReactElement } from 'react';
import { List, Paper, Text } from '@mantine/core';
import { ChargesTableErrorsFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableErrorsFields on Charge {
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
`;

interface Props {
  data?: FragmentType<typeof ChargesTableErrorsFieldsFragmentDoc>;
}

export const ChargeErrors = ({ data }: Props): ReactElement | null => {
  const charge = getFragmentData(ChargesTableErrorsFieldsFragmentDoc, data);

  return charge?.errorsLedger?.validate?.errors?.length ? (
    <Paper shadowSm="xs" p="md">
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
