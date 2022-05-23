import { Image } from '@mantine/core';
import gql from 'graphql-tag';
import { useState } from 'react';
import { PopUpModal } from '../common/Modal';
import { useDocumentsQuery } from '../../__generated__/types';
import { AccounterTable } from '../common/AccounterTable';
import { AccounterLoader } from '../common/Loader';
import { AccounterButton } from '../common/Button';

gql`
  fragment UnprocessedFields on Unprocessed {
    id
    image
    file
  }
  fragment InvoiceReceiptFields on Invoice {
    id
    image
    file
    vat {
      raw
      formatted
      currency
    }
    serialNumber
    date
    amount {
      raw
      formatted
      currency
    }
  }
  fragment InvoiceFields on Invoice {
    id
    image
    file
    vat {
      raw
      formatted
      currency
    }
    serialNumber
    date
    amount {
      raw
      formatted
      currency
    }
  }
  fragment ReceiptFields on Receipt {
    id
    image
    file
    vat {
      raw
      formatted
      currency
    }
    serialNumber
    date
  }
  fragment ProformaFields on Proforma {
    id
    image
    file
    vat {
      raw
      formatted
      currency
    }
    serialNumber
    date
    amount {
      raw
      formatted
      currency
    }
  }
  fragment ChargeFields on Charge {
    id
    createdAt
    description
    __typename
    tags
    vat {
      formatted
      __typename
    }
    transactions {
      id
      createdAt
      description
      effectiveDate
      amount {
        formatted
        __typename
      }
      userNote
    }
  }
  query Documents {
    documents {
      id
      image
      file
      charge {
        ...ChargeFields
      }
      __typename
      ...UnprocessedFields
      ...ProformaFields
      ...ReceiptFields
      ...InvoiceFields
      ...InvoiceReceiptFields
    }
  }
`;

export const DocumentsReport = () => {
  const { data, isLoading } = useDocumentsQuery();
  const [openedImage, setOpenedImage] = useState<string | null>(null);

  return (
    <>
      {isLoading ? (
        <AccounterLoader />
      ) : (
        <>
          {openedImage && (
            <PopUpModal
              modalSize="45%"
              content={
                <>
                  <Image src={openedImage} />
                </>
              }
              opened={openedImage}
              onClose={() => setOpenedImage(null)}
            />
          )}
          <div style={{ fontSize: 40 }}>Documents</div>
          <AccounterTable
            stickyHeader={true}
            items={data?.documents ?? []}
            columns={[
              { title: 'Type', value: docs => docs.__typename },
              {
                title: 'Image',
                value: docs =>
                  docs.image ? (
                    <button onClick={() => setOpenedImage(docs.image)}>
                      <img alt="missing img" src={docs.image} height={80} width={80} />
                    </button>
                  ) : (
                    'No image'
                  ),
              },
              {
                title: 'File',
                value: docs =>
                  docs.file && <AccounterButton target="_blank" rel="noreferrer" herf={docs.file} title="Open Link" />,
              },
              { title: 'Date', value: docs => null ?? docs.date },
              { title: 'Serial Number', value: docs => null ?? docs.serialNumber },
              { title: 'VAT', value: docs => null ?? docs.vat?.formatted },
              { title: 'Amount', value: docs => docs.charge?.transactions[0].amount.formatted ?? null },
              {
                title: 'Realted Transaction',
                value: docs =>
                  docs.charge?.transactions[0].id ? (
                    <AccounterTable
                      items={docs.charge?.transactions ?? []}
                      columns={[
                        {
                          title: 'Transaction Amount',
                          value: transaction => transaction.amount.formatted,
                        },
                        {
                          title: 'Transaction Created At',
                          value: transaction => transaction.createdAt,
                        },
                        {
                          title: 'Transaction Effective Date',
                          value: transaction => transaction.effectiveDate,
                        },
                        {
                          title: 'Transaction Description',
                          value: transaction => transaction.description,
                        },
                      ]}
                    />
                  ) : (
                    'No Realted Transaction'
                  ),
              },
            ]}
          />
        </>
      )}
    </>
  );
};
