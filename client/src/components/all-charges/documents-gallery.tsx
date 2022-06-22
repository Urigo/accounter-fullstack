import { Badge, Image } from '@mantine/core';
import { useState } from 'react';
import { DocumentsPopUp } from './documents-pop-up';
import gql from 'graphql-tag';
import { GalleryDocumentsFieldsFragment } from '../../__generated__/types';

gql`
  fragment GalleryDocumentsFields on Charge {
    additionalDocuments {
      id
      image
      file
      __typename
      ... on Unprocessed {
        id
        image
        file
        __typename
      }
      ... on Invoice {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
      }
      ... on Proforma {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
      }
      ... on Receipt {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
      }
      ... on InvoiceReceipt {
        vat {
          raw
          formatted
        }
        serialNumber
        date
        amount {
          raw
          formatted
        }
        __typename
      }
    }
  }
`;

type Props = {
  additionalDocumentsData: GalleryDocumentsFieldsFragment['additionalDocuments'];
};

export const DocumentsGallery = ({ additionalDocumentsData }: Props) => {
  const [openModal, setOpenModal] = useState<string | null>(null);
  const image = additionalDocumentsData[0]?.image;

  return (
    <div className="text-gray-600 body-font">
      <div className="container px-5 py-12 mx-auto">
        <div className="flex flex-col text-center w-full mb-5">
          {image ? <h1 className="text-lg">Realted Documents</h1> : <Badge color="red">No Documents Related</Badge>}
        </div>
        <div className="flex flex-wrap -m-4">
          {additionalDocumentsData.map(doc => (
            <>
              <div className="p-4 md:w-2/4">
                <div key={doc.id} className="flex rounded-lg h-full bg-gray-100 p-8 flex-col">
                  <h2 className="text-gray-900 text-lg title-font font-medium">{doc.__typename}</h2>
                  <Image
                    onClick={() => setOpenModal(doc.id)}
                    src={doc.image}
                    className="max-w-[100%] text-gray-900 text-lg title-font font-medium"
                  />
                </div>
              </div>
              <DocumentsPopUp
                onClose={() => setOpenModal(null)}
                key={doc.id}
                opened={openModal === doc.id}
                documentData={doc}
              />
            </>
          ))}
        </div>
      </div>
    </div>
  );
};
