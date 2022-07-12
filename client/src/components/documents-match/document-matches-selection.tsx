import { format } from 'date-fns';
import gql from 'graphql-tag';
import { useEffect, useState } from 'react';
import { Barcode, Bookmark, CalendarEvent, Coin, FileUnknown } from 'tabler-icons-react';

import { DocumentMatchChargesFieldsFragment, DocumentMatchFieldsFragment } from '../../__generated__/types';
import { rateOptionalMatches } from '../../helpers/document-matches';

gql`
  fragment DocumentMatchFields on Document {
    __typename
    id
    image
    file
    documentType
    creditor
    ... on Proforma {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on InvoiceReceipt {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on Invoice {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on Receipt {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
  }
  fragment DocumentMatchChargesFields on Query {
    financialEntity(id: $financialEntityId) {
      id
      charges {
        id
        totalAmount {
          raw
          formatted
          currency
        }
        counterparty {
          name
        }
        transactions {
          createdAt
          description
        }
      }
    }
  }
`;

interface Props {
  document: DocumentMatchFieldsFragment;
  charges: DocumentMatchChargesFieldsFragment['financialEntity']['charges'];
  setReadyForNextStep: (ready: boolean) => void;
  setSelectedChargeId: (id: string) => void;
}

export function DocumentMatchesSelection({ document, charges, setReadyForNextStep, setSelectedChargeId }: Props) {
  const [selectedCharge, setSelectedCharge] = useState<string | null>(null);
  const [extandedInfoFlag, setExtandedInfoFlag] = useState(false);

  useEffect(() => {
    setReadyForNextStep(!!selectedCharge);
  }, [selectedCharge, setReadyForNextStep]);

  if (
    (document.__typename !== 'Invoice' &&
      document.__typename !== 'Receipt' &&
      document.__typename !== 'InvoiceReceipt' &&
      document.__typename !== 'Proforma') ||
    document.amount?.raw == null ||
    !document.date
  ) {
    return <p>Document information missing, return to previous step</p>;
  }

  const filteredCharges = charges.filter(charge => {
    if (!charge.transactions[0]?.createdAt || charge.totalAmount?.raw == null) {
      return false;
    }
    const chargeAmount = Math.abs(charge.totalAmount.raw);
    const documentAmount = Math.abs(document.amount!.raw);
    const chargeDate = new Date(charge.transactions[0].createdAt).getTime();
    const documentDate = new Date(document.date).getTime();

    const fee = documentAmount > 3000 ? 30 : 0;

    return (
      documentAmount >= Math.floor(chargeAmount) &&
      documentAmount <= Math.ceil(chargeAmount + fee) &&
      Math.abs(documentDate - chargeDate) < 5184000000
    );
  });

  if (filteredCharges.length === 0) {
    return <p>No matches found</p>;
  }

  const ratedMatches = rateOptionalMatches(document, filteredCharges);

  return (
    <div className="relative items-center w-full mx-auto md:px-12 lg:px-2 max-w-8xl">
      <div>
        <div
          className={`relative p-10 space-y-12 overflow-hidden lg:space-y-0 lg:grid lg:grid-cols-${
            ratedMatches.length > 2 ? '4' : String(ratedMatches.length + 1)
          } lg:gap-x-8 rounded-xl`}
        >
          <div className="relative flex flex-col p-8 bg-white">
            <div className="flex-1">
              <h3 className="text-l font-semibold text-neutral-600">{document.documentType}</h3>
              <p className="flex items-baseline mt-4 text-neutral-600">
                <span className="text-5xl font-extrabold tracking-tight">{document.amount.formatted}</span>
              </p>
              <p className="mt-6 text-gray-500">{document.creditor}</p>
              <ul className="pt-6 mt-6 space-y-6 border-t">
                <li className="flex">
                  <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                    <FileUnknown color="white" />
                  </div>
                  <span className="ml-3 text-neutral-600">{document.documentType}</span>
                </li>
                <li className="flex">
                  <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                    <Barcode color="white" />
                  </div>
                  <span className="ml-3 text-neutral-600">{document.serialNumber}</span>
                </li>
                <li className="flex">
                  <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                    <CalendarEvent color="white" />
                  </div>
                  <span className="ml-3 text-neutral-600">{document.date}</span>
                </li>
                <li className="flex">
                  <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                    <Coin color="white" />
                  </div>
                  <span className="ml-3 text-neutral-600">{document.amount.formatted}</span>
                </li>
                <li className="flex">
                  <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                    <Bookmark color="white" />
                  </div>
                  <span className="ml-3 text-neutral-600">{document.creditor}</span>
                </li>
                {extandedInfoFlag ? (
                  <>
                    <li></li>
                    <li>
                      <button
                        onClick={() => setExtandedInfoFlag(false)}
                        className="inline-flex items-center mt-4 font-semibold text-blue-600 lg:mb-0 hover:text-neutral-600"
                        title="read less"
                      >
                        {' '}
                        « Less Info{' '}
                      </button>
                    </li>
                  </>
                ) : (
                  <li>
                    <button
                      onClick={() => setExtandedInfoFlag(true)}
                      className="inline-flex items-center mt-4 font-semibold text-blue-600 lg:mb-0 hover:text-neutral-600"
                      title="read more"
                    >
                      {' '}
                      More Info »{' '}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
          {ratedMatches.map(({ charge }) => (
            <div key={charge.id} className="relative flex flex-col p-8 bg-blue-600 rounded-2xl">
              <div className="relative flex-1">
                <h3 className="text-xl font-semibold text-white">Charge</h3>
                <p className="flex items-baseline mt-4 text-white">
                  <span className="text-5xl font-extrabold tracking-tight">{charge.totalAmount?.formatted}</span>
                </p>
                <p className="mt-6 text-gray-300">{charge.counterparty?.name}</p>
                <ul className="pt-6 mt-6 space-y-6 border-t">
                  <li className="flex">
                    <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                      <FileUnknown color="blue" />
                    </div>
                    <span className="ml-3 text-white">Charge</span>
                  </li>
                  <li className="flex">
                    <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                      <Barcode color="blue" />
                    </div>
                    <span className="ml-3 text-white">{}</span>
                  </li>
                  <li className="flex">
                    <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                      <CalendarEvent color="blue" />
                    </div>
                    <span className="ml-3 text-white">
                      {format(new Date(charge.transactions[0].createdAt), 'yyyy-MM-dd')}
                    </span>
                  </li>
                  <li className="flex">
                    <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                      <Coin color="blue" />
                    </div>
                    <span className="ml-3 text-white">{charge.totalAmount?.formatted}</span>
                  </li>
                  <li className="flex">
                    <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                      <Bookmark color="blue" />
                    </div>
                    <span className="ml-3 text-white">{charge.transactions[0].description}</span>
                  </li>
                  {extandedInfoFlag ? (
                    <>
                      <li></li>
                      <li>
                        <button
                          onClick={() => setExtandedInfoFlag(false)}
                          className="inline-flex items-center mt-4 font-semibold text-white lg:mb-0 hover:text-neutral-300"
                          title="read less"
                        >
                          {' '}
                          « Less Info{' '}
                        </button>
                      </li>
                    </>
                  ) : (
                    <li>
                      <button
                        onClick={() => setExtandedInfoFlag(true)}
                        className="inline-flex items-center mt-4 font-semibold text-white lg:mb-0 hover:text-neutral-300"
                        title="read more"
                      >
                        {' '}
                        More Info »{' '}
                      </button>
                    </li>
                  )}
                </ul>
              </div>
              <div className="z-50 mt-6 rounded-lg">
                <button
                  onClick={() => {
                    setSelectedCharge(charge.id);
                    setSelectedChargeId(charge.id);
                    setReadyForNextStep(true);
                  }}
                  className="w-full items-center block px-10 py-3.5 text-base font-medium text-center text-blue-600 transition duration-500 ease-in-out transform border-2 border-white shadow-md rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 bg-white"
                  style={selectedCharge === charge.id ? { backgroundColor: 'lightGreen' } : {}}
                >
                  Match
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
