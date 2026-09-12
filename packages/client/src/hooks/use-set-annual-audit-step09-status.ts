import {
  SetAnnualAuditStep09StatusDocument,
  type SetAnnualAuditStep09StatusMutation,
  type SetAnnualAuditStep09StatusMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetAnnualAuditStep09Status($input: SetAnnualAuditStep09StatusInput!) {
    setAnnualAuditStep09Status(input: $input) {
      id
      ownerId
      year
      stepId
      status
      notes
      evidence
      updatedAt
      completedAt
    }
  }
`;

type UseSetAnnualAuditStep09Status = {
  fetching: boolean;
  setStep09Status: (
    variables: SetAnnualAuditStep09StatusMutationVariables,
  ) => Promise<SetAnnualAuditStep09StatusMutation['setAnnualAuditStep09Status'] | void>;
};

const NOTIFICATION_ID = 'setAnnualAuditStep09Status';

export const useSetAnnualAuditStep09Status = (): UseSetAnnualAuditStep09Status => {
  const { fetching, execute } = useApiMutation({
    document: SetAnnualAuditStep09StatusDocument,
    notificationId: ({ input }) => `${NOTIFICATION_ID}-${input.ownerId}-${input.year}`,
    loadingMessage: 'Locking template...',
    errorMessage: 'Error saving final dynamic report template selection',
    select: data => data.setAnnualAuditStep09Status,
    successToast: (_result, { input }) => ({
      title: 'Template locked',
      description: `"${input.templateName}" saved as the final dynamic report template`,
    }),
    // This flow keeps sonner's default toast lifetime rather than the app-wide long-lived one.
    errorToast: { duration: undefined, closeButton: undefined },
  });

  return { fetching, setStep09Status: execute };
};
