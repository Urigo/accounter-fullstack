import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { AllGreenInvoiceBusinessesDocument } from '../../../../gql/graphql.js';
import { AccounterLoader } from '../../../common/loader.js';
import { IssueDocumentsTable } from './issue-documents-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AllGreenInvoiceBusinesses {
    greenInvoiceBusinesses {
      id
      greenInvoiceId
      remark
      emails
      generatedDocumentType
      originalBusiness {
        id
        name
      }
    }
  }
`;

export const IssueDocuments = (): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: AllGreenInvoiceBusinessesDocument,
  });

  return fetching ? (
    <AccounterLoader />
  ) : (
    <IssueDocumentsTable businessesData={data?.greenInvoiceBusinesses ?? []} />
  );
};
