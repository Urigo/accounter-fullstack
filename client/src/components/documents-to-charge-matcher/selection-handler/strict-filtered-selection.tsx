import { useState } from 'react';
import { format } from 'date-fns';
import { Barcode, Bookmark, CalendarEvent, Coin, FileUnknown } from 'tabler-icons-react';
import {
  ChargeToMatchDocumentsFieldsFragment,
  DocumentsToMatchFieldsFragment,
} from '../../../gql/graphql';
import { rateOptionalDocumentsMatches } from '../../../helpers/document-matches';

interface Props {
  documents: Exclude<DocumentsToMatchFieldsFragment, { __typename: 'Unprocessed' }>[];
  charge: ChargeToMatchDocumentsFieldsFragment;
  toggleDocument(documentId: string): void;
  selectedDocuments: string[];
}

export function StrictFilteredSelection({
  charge,
  documents,
  toggleDocument,
  selectedDocuments,
}: Props) {
  const [extandedInfoFlag, setExtandedInfoFlag] = useState(false);

  const ratedMatches = rateOptionalDocumentsMatches(charge, documents);

  return (
    <div
      className={`relative p-2 space-y-3 overflow-hidden lg:space-y-0 lg:grid lg:grid-cols-${
        ratedMatches.length > 2 ? '4' : String(ratedMatches.length + 1)
      } lg:gap-x-3 rounded-xl`}
    >
      <div className="relative flex flex-col p-5 bg-white">
        <div className="flex-1">
          <h3 className="text-l font-semibold text-neutral-600">Charge</h3>
          <p className="flex items-baseline mt-4 text-neutral-600">
            <span className="text-5xl font-extrabold tracking-tight">
              {charge.totalAmount?.formatted}
            </span>
          </p>
          <p className="mt-6 text-gray-500">{charge.counterparty?.name}</p>
          <ul className="pt-6 mt-6 space-y-6 border-t">
            <li className="flex">
              <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                <FileUnknown color="white" />
              </div>
              <span className="ml-3 text-neutral-600">Charge</span>
            </li>
            <li className="flex">
              <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                <Barcode color="white" />
              </div>
              <span className="ml-3 text-neutral-600">{}</span>
            </li>
            <li className="flex">
              <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                <CalendarEvent color="white" />
              </div>
              <span className="ml-3 text-neutral-600">
                {format(new Date(charge.transactions[0].createdAt), 'yyyy-MM-dd')}
              </span>
            </li>
            <li className="flex">
              <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                <Coin color="white" />
              </div>
              <span className="ml-3 text-neutral-600">{charge.totalAmount?.formatted}</span>
            </li>
            <li className="flex">
              <div className="inline-flex items-center w-6 h-6 bg-blue-600 rounded-xl p-0.5">
                <Bookmark color="white" />
              </div>
              <span className="ml-3 text-neutral-600">{charge.transactions[0].description}</span>
            </li>
            {extandedInfoFlag ? (
              <>
                <li />
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
      {ratedMatches.map(({ document }) => (
        <div key={document.id} className="relative flex flex-col p-5 bg-blue-600 rounded-2xl">
          <div className="relative flex-1">
            <h3 className="text-xl font-semibold text-white">{document.documentType}</h3>
            <p className="flex items-baseline mt-4 text-white">
              <span className="text-5xl font-extrabold tracking-tight">
                {document.amount?.formatted}
              </span>
            </p>
            <p className="mt-6 text-gray-300">{document.creditor}</p>
            <ul className="pt-6 mt-6 space-y-6 border-t">
              <li className="flex">
                <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                  <FileUnknown color="blue" />
                </div>
                <span className="ml-3 text-white">{document.documentType}</span>
              </li>
              <li className="flex">
                <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                  <Barcode color="blue" />
                </div>
                <span className="ml-3 text-white">{document.serialNumber}</span>
              </li>
              <li className="flex">
                <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                  <CalendarEvent color="blue" />
                </div>
                <span className="ml-3 text-white">{document.date}</span>
              </li>
              <li className="flex">
                <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                  <Coin color="blue" />
                </div>
                <span className="ml-3 text-white">{document.amount?.formatted}</span>
              </li>
              <li className="flex">
                <div className="inline-flex items-center w-6 h-6 bg-white rounded-xl p-0.5">
                  <Bookmark color="blue" />
                </div>
                <span className="ml-3 text-white">{document.creditor}</span>
              </li>
              {extandedInfoFlag ? (
                <>
                  <li />
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
                toggleDocument(document.id);
              }}
              className="w-full items-center block px-10 py-3.5 text-base font-medium text-center text-blue-600 transition duration-500 ease-in-out transform border-2 border-white shadow-md rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 bg-white"
              style={
                selectedDocuments.includes(document.id) ? { backgroundColor: 'lightGreen' } : {}
              }
            >
              Match
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
