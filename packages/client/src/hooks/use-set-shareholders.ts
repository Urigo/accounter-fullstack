import {
  SetShareholdersDocument,
  type SetShareholdersMutation,
  type SetShareholdersMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetShareholders($year: Int!, $shareholders: [ShareholderInput!]!) {
    setShareholders(year: $year, shareholders: $shareholders) {
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

type UseSetShareholders = {
  fetching: boolean;
  /** Replaces the active business's shareholders of a tax year; the list order is the report order. */
  setShareholders: (
    variables: SetShareholdersMutationVariables,
  ) => Promise<SetShareholdersMutation['setShareholders'] | void>;
};

export const useSetShareholders = (): UseSetShareholders => {
  const { fetching, execute } = useApiMutation({
    document: SetShareholdersDocument,
    notificationId: ({ year }) => `setShareholders-${year}`,
    loadingMessage: 'Saving shareholders',
    errorMessage: ({ year }) => `Error saving the shareholders of ${year}`,
    select: data => data.setShareholders,
    successToast: (shareholders, { year }) => ({
      title: 'Shareholders saved',
      description: `${shareholders.length} shareholder${shareholders.length === 1 ? '' : 's'} for ${year}`,
    }),
  });

  return { fetching, setShareholders: execute };
};
