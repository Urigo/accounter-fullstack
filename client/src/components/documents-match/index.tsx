import { Pagination } from '@mantine/core';
import gql from 'graphql-tag';
import { useState } from 'react';

import { DocumentsToMatchQuery, useDocumentsToMatchQuery } from '../../__generated__/types';
import { AccounterLoader } from '../common/loader';
import { DocumentHandler } from './document-handler';

gql`
  query DocumentsToMatch($financialEntityId: ID!, $page: Int, $limit: Int) {
    documents {
      id
      charge {
        id
      }
      ...DocumentHandlerFields
    }
    ...DocumentMatchChargesFields
  }
`;

export function DocumentsMatch() {
  // TODO: improve the ID logic
  const financialEntityId = '6a20aa69-57ff-446e-8d6a-1e96d095e988';

  const { data, isLoading } = useDocumentsToMatchQuery(
    { financialEntityId },
    {
      onSuccess: data => {
        setDocuments(data.documents.filter(doc => !doc.charge));
        return data;
      },
    }
  );

  const [documents, setDocuments] = useState<DocumentsToMatchQuery['documents']>([]);
  const [activeDocumentIndex, setActiveDocumentIndex] = useState(1);

  function removeDocument(index?: number) {
    const indexToRemove = index ?? activeDocumentIndex - 1;
    const tempDocuments = [...documents];
    tempDocuments.splice(indexToRemove, 1);
    setDocuments(tempDocuments);
    // if last item removed, select the prev item
    if (activeDocumentIndex > tempDocuments.length) {
      setActiveDocumentIndex(tempDocuments.length);
    }
  }

  return (
    <div className="text-gray-600 body-font">
      <div className="container px-5 py-12 mx-auto">
        <div className="flex flex-col text-center w-full mb-1">
          <h1 className="sm:text-4xl text-3xl font-medium title-font mb-6 text-gray-900">Document Matches</h1>
        </div>
        {documents?.length === 0 && (
          <div className="flex flex-col text-center w-full mb-1">
            {isLoading ? (
              <AccounterLoader />
            ) : (
              <h3 className="sm:text-2xl text-xl font-medium title-font mb-6 text-gray-900">No Document Found</h3>
            )}
          </div>
        )}
        {documents?.length > 0 && (
          <div className="flex flex-col gap-3">
            <Pagination page={activeDocumentIndex} onChange={setActiveDocumentIndex} total={documents.length} />
            <DocumentHandler
              document={documents[activeDocumentIndex - 1]}
              charges={data?.financialEntity?.charges ?? []}
              skipDocument={removeDocument}
            />
          </div>
        )}
      </div>
    </div>
  );
}
