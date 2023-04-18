import { useState } from 'react';
import { Image } from '@mantine/core';
import { AccounterTable, Button, PopUpModal } from '../../';
import {
  ChargeToMatchDocumentsFieldsFragment,
  DocumentsToMatchFieldsFragment,
} from '../../../../gql/graphql';

interface Props {
  documents: Exclude<DocumentsToMatchFieldsFragment, { __typename: 'Unprocessed' }>[];
  charge: ChargeToMatchDocumentsFieldsFragment;
  toggleDocument(documentId: string): void;
  selectedDocuments: string[];
}

export function WideFilteredSelection({ documents, toggleDocument, selectedDocuments }: Props) {
  const [openedImage, setOpenedImage] = useState<string | null>(null);

  return (
    <>
      {openedImage && (
        <PopUpModal
          modalSize="45%"
          content={<Image src={openedImage} />}
          opened={!!openedImage}
          onClose={() => setOpenedImage(null)}
        />
      )}
      <AccounterTable
        stickyHeader
        items={documents}
        columns={[
          { title: 'Type', value: doc => doc.__typename },
          {
            title: 'Image',
            value: doc =>
              doc.image ? (
                <button onClick={() => setOpenedImage(doc.image?.toString() ?? null)}>
                  <img alt="missing img" src={doc.image?.toString()} height={80} width={80} />
                </button>
              ) : (
                'No image'
              ),
          },
          {
            title: 'File',
            value: doc =>
              doc.file && (
                <Button
                  target="_blank"
                  rel="noreferrer"
                  herf={doc.file?.toString()}
                  title="Open Link"
                />
              ),
          },
          { title: 'Date', value: doc => ('date' in doc ? doc.date : null) },
          {
            title: 'Serial Number',
            value: doc => ('serialNumber' in doc ? doc.serialNumber : null),
          },
          { title: 'Amount', value: doc => doc.amount?.formatted ?? null },
          { title: 'Provider', value: doc => doc.creditor ?? null },
          {
            title: 'Match',
            value: doc => (
              <button
                onClick={() => {
                  toggleDocument(doc.id);
                }}
                className="w-full items-center block px-10 py-3.5 text-base font-medium text-center text-blue-600 transition duration-500 ease-in-out transform border-2 border-white shadow-md rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 bg-white"
                style={selectedDocuments.includes(doc.id) ? { backgroundColor: 'lightGreen' } : {}}
              >
                Match
              </button>
            ),
          },
        ]}
      />
    </>
  );
}
