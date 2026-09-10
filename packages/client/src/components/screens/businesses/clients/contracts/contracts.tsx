import { useContext, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { AccounterLoader } from '@/components/common/index.js';
import { ContractsTable } from '@/components/contracts/index.js';
import { ContractsScreenDocument } from '@/gql/graphql.js';
import { UserContext } from '@/providers/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ContractsScreen($adminId: UUID!) {
    contractsByAdmin(adminId: $adminId) {
      id
      ...ContractForContractsTableFields
    }
  }
`;

export const ContractsScreen = (): ReactElement => {
  const { userContext } = useContext(UserContext);
  const adminId = userContext?.context.adminBusinessId;

  const [{ data: contractsData, fetching: isLoading }] = useQuery({
    query: ContractsScreenDocument,
    pause: !adminId,
    variables: {
      adminId: adminId ?? '',
    },
  });

  if (isLoading && !contractsData?.contractsByAdmin) {
    return <AccounterLoader />;
  }

  if (!adminId || !contractsData?.contractsByAdmin) {
    return <div>Contracts not found</div>;
  }

  return <ContractsTable data={contractsData.contractsByAdmin} />;
};
