import { Modal } from '@mantine/core';
import gql from 'graphql-tag';
import { CSSProperties, ReactNode } from 'react';

import { ModalDocumentsFieldsFragment } from '../../__generated__/types';
import {
  isDocumentInvoice,
  isDocumentInvoiceReceipt,
  isDocumentProforma,
  isDocumentReceipt,
} from '../../helpers/documents';
import { ButtonWithLabel } from '../common/button-with-label';
import { Input } from '../common/input';

gql`
  fragment ModalDocumentsFields on Charge {
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

export interface Props {
  style?: CSSProperties;
  opened: boolean;
  onClose: () => void;
  documentData?: ModalDocumentsFieldsFragment['additionalDocuments']['0'];
  content?: ReactNode;
}

export const DocumentsPopUp = ({ opened, onClose, documentData }: Props) => {
  return (
    <Modal
      size="70%"
      opened={opened}
      onClose={onClose}
      title={<h1 className="title-font sm:text-4xl text-3xl mb-4 font-medium text-gray-900">Edit Documents</h1>}
    >
      {isDocumentInvoice(documentData) ||
      isDocumentReceipt(documentData) ||
      isDocumentInvoiceReceipt(documentData) ||
      isDocumentProforma(documentData) ? (
        <>
          <div style={{ flexDirection: 'row', display: 'flex', gap: 10 }}>
            <div style={{ width: '50%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <div className="container mx-auto flex py-12 md: flex-col items-center">
                <Input
                  inputInfo={[
                    { textLabel: 'Type', placeholder: documentData?.__typename },
                    { textLabel: 'Amount', placeholder: String(documentData?.amount?.raw) && 'No data for Amount' },
                    { textLabel: 'Date', placeholder: String(documentData?.date) && 'No data for Date' },
                    { textLabel: 'ID', placeholder: documentData?.id },
                    {
                      textLabel: 'Serial Number',
                      placeholder: String(documentData?.serialNumber) && 'No data for Serial Number',
                    },
                    { textLabel: 'VAT', placeholder: String(documentData?.vat) && 'No data for VAT' },
                  ]}
                />
                <ButtonWithLabel textLabel="File" url={documentData?.file} textButton="Open Link" />
              </div>
            </div>
            <div style={{ width: '50%', flexDirection: 'column' }}>
              <div>
                <div className="container mx-auto flex  md:flex-row flex-col items-right">
                  <img className="object-cover object-center rounded" alt="hero" src={documentData?.image} />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="container mx-auto flex py-12 md: flex-col items-center">
          <Input
            inputInfo={[
              { textLabel: 'Type', placeholder: documentData?.__typename },
              { textLabel: 'ID', placeholder: documentData?.id },
            ]}
          />
          <ButtonWithLabel textLabel="File" url={documentData?.file} textButton="Open Link" />
        </div>
      )}
    </Modal>
  );
};
