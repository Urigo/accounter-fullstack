import {
  SetAnnualAuditStep03StatusDocument,
  type SetAnnualAuditStep03StatusMutation,
  type SetAnnualAuditStep03StatusMutationVariables,
} from '../gql/graphql.js';
import { useApiMutation } from './use-api-mutation.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  mutation SetAnnualAuditStep03Status($input: SetAnnualAuditStep03StatusInput!) {
    setAnnualAuditStep03Status(input: $input) {
      id
      ownerId
      year
      stepId
      status
      notes
      updatedAt
      completedAt
    }
  }
`;

type UseSetAnnualAuditStep03Status = {
  fetching: boolean;
  setStep03Status: (
    variables: SetAnnualAuditStep03StatusMutationVariables,
  ) => Promise<SetAnnualAuditStep03StatusMutation['setAnnualAuditStep03Status'] | void>;
};

const NOTIFICATION_ID = 'setAnnualAuditStep03Status';

export const useSetAnnualAuditStep03Status = (): UseSetAnnualAuditStep03Status => {
  const { fetching, execute } = useApiMutation({
    document: SetAnnualAuditStep03StatusDocument,
    notificationId: ({ input }) => `${NOTIFICATION_ID}-${input.ownerId}-${input.year}`,
    loadingMessage: 'Saving approval...',
    errorMessage: 'Error saving opening balance approval',
    select: data => data.setAnnualAuditStep03Status,
    successToast: { title: 'Saved', description: 'Opening balance approval updated' },
    // This flow keeps sonner's default toast lifetime rather than the app-wide long-lived one.
    errorToast: { duration: undefined, closeButton: undefined },
  });

  return { fetching, setStep03Status: execute };
};
