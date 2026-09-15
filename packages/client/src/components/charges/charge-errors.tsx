import type { ReactElement } from 'react';
import { ChargesTableErrorsFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { Card } from '../ui/card.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableErrorsFields on Charge {
    id
    errorsLedger: ledger {
      validate {
        errors
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
    // Mantine's `Paper shadow="xs" p="md"` carried its own 16px padding; shadcn's Card
    // carries none. `List withPadding` indented by theme.spacing.xl (32px), and its
    // list-style-position was inside with no padding of its own.
    <Card className="p-4 shadow-xs">
      <div className="text-red-500">Errors:</div>
      <ul className="list-disc list-inside pl-8 text-sm">
        {charge.errorsLedger.validate.errors.map((error, i) => (
          <li key={i} className="text-red-500">
            {error}
          </li>
        ))}
      </ul>
    </Card>
  ) : null;
};
