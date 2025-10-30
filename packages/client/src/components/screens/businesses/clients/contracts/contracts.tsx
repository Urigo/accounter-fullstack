import { useContext, type ReactElement } from 'react';
import { useLoaderData } from 'react-router-dom';
import { useQuery } from 'urql';
import { AccounterLoader } from '@/components/common/index.js';
import { ContractsTable } from '@/components/contracts/index.js';
import { ContractsScreenDocument, type ContractsScreenQuery } from '@/gql/graphql.js';
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

  // Try to get loader data (will be available when navigating via router)
  let loaderData: ContractsScreenQuery | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    loaderData = useLoaderData() as ContractsScreenQuery;
  } catch {
    // No loader data - fallback to query
  }

  // Only fetch if we don't have loader data
  const [{ data, fetching }] = useQuery({
    query: ContractsScreenDocument,
    pause: !adminId || !!loaderData,
    variables: {
      adminId: adminId ?? '',
    },
  });

  // Use loader data if available, otherwise use query data
  const contractsData = loaderData || data;
  const isLoading = !loaderData && fetching;

  if (isLoading && !contractsData?.contractsByAdmin) {
    return <AccounterLoader />;
  }

  if (!adminId || !contractsData?.contractsByAdmin) {
    return <div>Contracts not found</div>;
  }

  return <ContractsTable data={contractsData.contractsByAdmin} />;
};
