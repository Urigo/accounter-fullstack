import type { ReactElement } from 'react';
import { ChargesTableErrorsFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { Card } from '../ui/card.js';
import { SecuritiesTaxCategoryDialog } from './securities-tax-category-dialog.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableErrorsFields on Charge {
    id
    errorsLedger: ledger {
      validate {
        errors
        missingSecuritiesTaxCategories
      }
    }
  }
`;

interface Props {
  data?: FragmentType<typeof ChargesTableErrorsFieldsFragmentDoc>;
  /** Called once a missing configuration was set, so the charge can be refetched */
  onChange?: () => void;
}

export const ChargeErrors = ({ data, onChange }: Props): ReactElement | null => {
  const charge = getFragmentData(ChargesTableErrorsFieldsFragmentDoc, data);
  const errors = charge?.errorsLedger?.validate?.errors ?? [];
  const missingSecuritiesTaxCategories =
    charge?.errorsLedger?.validate?.missingSecuritiesTaxCategories ?? [];

  return charge && (errors.length || missingSecuritiesTaxCategories.length) ? (
    // Mantine's `Paper shadow="xs" p="md"` carried its own 16px padding; shadcn's Card
    // carries none. `List withPadding` indented by theme.spacing.xl (32px), and its
    // list-style-position was inside with no padding of its own.
    <Card className="p-4 shadow-xs">
      <div className="text-red-500">Errors:</div>
      <ul className="list-disc list-inside pl-8 text-sm">
        {errors.map((error, i) => (
          <li key={i} className="text-red-500">
            {error}
          </li>
        ))}
      </ul>
      {missingSecuritiesTaxCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-3 pl-8">
          {missingSecuritiesTaxCategories.map(taxCategoryKey => (
            <SecuritiesTaxCategoryDialog
              key={taxCategoryKey}
              taxCategoryKey={taxCategoryKey}
              chargeId={charge.id}
              onDone={onChange}
            />
          ))}
        </div>
      )}
    </Card>
  ) : null;
};
