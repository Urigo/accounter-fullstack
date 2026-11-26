import {
  CopyShareholdersFromYearDocument,
  type CopyShareholdersFromYearMutation,
  type CopyShareholdersFromYearMutationVariables,
} from '../gql/graphql.js';
import { MUTATION_DEDUPE_WINDOW_MS } from '../helpers/mutation-dedupe.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation CopyShareholdersFromYear($fromYear: Int!, $toYear: Int!) {
    copyShareholdersFromYear(fromYear: $fromYear, toYear: $toYear) {
      id
      idNumber
      fullName
      isControllingShareholder
      dividendRightsPercent
      votingRightsPercent
      otherRightsPercent
      isMaterialShareholder
      salaryMonths1To9
      salaryMonths10To12
      otherPayments
      businessId
    }
  }
`;

type UseCopyShareholdersFromYear = {
  fetching: boolean;
  /**
   * Copies the active business's shareholders of `fromYear` into `toYear`, which must have none.
   * Resolves to the copied shareholders: an empty list when `fromYear` has none.
   */
  copyShareholdersFromYear: (
    variables: CopyShareholdersFromYearMutationVariables,
  ) => Promise<CopyShareholdersFromYearMutation['copyShareholdersFromYear'] | void>;
};

export const useCopyShareholdersFromYear = (): UseCopyShareholdersFromYear => {
  const { fetching, execute } = useApiMutation({
    document: CopyShareholdersFromYearDocument,
    notificationId: ({ fromYear, toYear }) => `copyShareholdersFromYear-${fromYear}-${toYear}`,
    loadingMessage: ({ fromYear }) => `Copying the shareholders of ${fromYear}`,
    errorMessage: ({ fromYear, toYear }) =>
      `Error copying the shareholders of ${fromYear} into ${toYear}`,
    select: data => data.copyShareholdersFromYear,
    successToast: (shareholders, { fromYear, toYear }) =>
      shareholders.length === 0
        ? { variant: 'info', title: `No shareholders in ${fromYear}` }
        : {
            title: 'Shareholders copied',
            description: `${shareholders.length} shareholder${shareholders.length === 1 ? '' : 's'} copied from ${fromYear} into ${toYear}`,
          },
    // Creates rows: a double click must not send it twice (the second would fail anyway, as the
    // target year is no longer empty)
    dedupe: { windowMs: MUTATION_DEDUPE_WINDOW_MS },
  });

  return { fetching, copyShareholdersFromYear: execute };
};
