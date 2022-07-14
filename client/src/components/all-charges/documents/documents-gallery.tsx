import { Badge, Image } from '@mantine/core';
import gql from 'graphql-tag';
import { useState } from 'react';

import { DocumentsGalleryFieldsFragment } from '../../../__generated__/types';
import { PopUpDrawer } from '../../common/drawer';
import { EditDocument } from './edit-document';
import { UnlinkDocumentButton } from './unlink-document-button';

gql`
  fragment DocumentsGalleryFields on Charge {
    additionalDocuments {
      ...EditDocumentFields
      id
      image
      ... on Invoice {
        documentType
      }
      ... on Proforma {
        documentType
      }
      ... on Receipt {
        documentType
      }
      ... on InvoiceReceipt {
        documentType
      }
    }
  }
`;

type Props = {
  additionalDocumentsData: DocumentsGalleryFieldsFragment['additionalDocuments'];
};

export const DocumentsGallery = ({ additionalDocumentsData }: Props) => {
  const [openModal, setOpenModal] = useState<string | null>(null);

  return (
    <div className="text-gray-600 body-font">
      <div className="container px-5 py-12 mx-auto">
        {additionalDocumentsData.length > 0 ? (
          <>
            <div className="flex flex-col text-center w-full mb-5">
              <h1 className="text-lg">Realted Documents</h1>
            </div>
            <div className="flex flex-wrap -m-4">
              {additionalDocumentsData.map(doc => (
                <div key={doc.id} className="p-4 md:w-2/4">
                  <button onClick={() => setOpenModal(doc.id)}>
                    <div className="flex rounded-lg h-full bg-gray-100 p-8 flex-col">
                      <h2 className="text-gray-900 text-lg title-font font-medium">
                        {'documentType' in doc ? doc.documentType : 'Unprocessed'}
                      </h2>
                      <Image src={doc.image} className="max-w-[100%] text-gray-900 text-lg title-font font-medium" />
                    </div>
                  </button>
                  {openModal === doc.id && (
                    <PopUpDrawer
                      modalSize="40%"
                      position="bottom"
                      opened={openModal === doc.id}
                      onClose={() => setOpenModal(null)}
                      title={
                        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
                          <h1 className="sm:text-2xl font-small text-gray-900">Edit Documents</h1>
                          <a href="/#" className="pt-1">
                            ID: {doc.id}
                          </a>
                          <UnlinkDocumentButton documentId={doc.id} />
                        </div>
                      }
                    >
                      <EditDocument documentData={doc} />
                    </PopUpDrawer>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <Badge color="red">No Documents Related</Badge>
        )}
      </div>
    </div>
  );
};
