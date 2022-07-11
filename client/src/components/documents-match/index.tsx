import { Pagination } from '@mantine/core';
import { useState } from 'react';

import { DocumentHandler } from './document-handler';

export function DocumentsMatch() {
  // TODO: get unmatched documents
  const documentsToMatch: any[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const [documents, setDocuments] = useState(documentsToMatch);
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
        {documents.length === 0 ? (
          <div className="flex flex-col text-center w-full mb-1">
            <h3 className="sm:text-2xl text-xl font-medium title-font mb-6 text-gray-900">No Document Found</h3>
          </div>
        ) : (
          <>
            <Pagination page={activeDocumentIndex} onChange={setActiveDocumentIndex} total={documents.length} />
            <DocumentHandler document={documents[activeDocumentIndex]} skipDocument={removeDocument} />
          </>
        )}
      </div>
    </div>
  );
}
