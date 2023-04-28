import { useQuery } from 'urql';
import { AccounterLoader } from '../';
import { DocumentsToChargeMatcherDocument } from '../../../gql/graphql';
import { SelectionHandler } from './selection-handler';

/* GraphQL */ `
  query DocumentsToChargeMatcher($chargeIds: [ID!]!) {
    documents {
      id
      ...DocumentsToMatchFields
    }
    chargesByIDs(chargeIDs: $chargeIds) {
      id
      transactions {
        id
        eventDate
      }
      totalAmount {
        raw
      }
      ...ChargeToMatchDocumentsFields
    }
  }
`;

interface Props {
  chargeId: string;
  onDone: () => void;
}

export function DocumentsToChargeMatcher({ chargeId, onDone }: Props) {
  const [{ data, fetching }] = useQuery({
    query: DocumentsToChargeMatcherDocument,
    variables: { chargeIds: [chargeId] },
  });

  const errorMessage =
    (data?.documents.length === 0 && 'No Document Found') ||
    ((!data?.chargesByIDs || data.chargesByIDs.length === 0) && 'Charge was not found') ||
    (data?.chargesByIDs[0].totalAmount?.raw == null && 'Charge is missing amount') ||
    (!data?.chargesByIDs[0].transactions[0]?.eventDate && 'Charge is missing date') ||
    undefined;

  return (
    <div className="text-gray-600 body-font">
      <div className="container px-2 py-5 mx-auto">
        {/* <div className="flex flex-col text-center w-full mb-1">
            <h1 className="sm:text-4xl text-3xl font-medium title-font mb-6 text-gray-900">Document Matches</h1>
        </div> */}
        {fetching && (
          <div className="flex flex-col text-center w-full mb-1">
            <AccounterLoader />
          </div>
        )}
        {errorMessage && (
          <div className="flex flex-col text-center w-full mb-1">
            <h3 className="sm:text-2xl text-xl font-medium title-font mb-6 text-gray-900">
              {errorMessage}
            </h3>
          </div>
        )}
        {!errorMessage && (
          <div className="flex flex-col gap-3">
            <SelectionHandler
              chargeProps={data!.chargesByIDs[0]}
              documentsProps={data}
              onDone={onDone}
            />
          </div>
        )}
      </div>
    </div>
  );
}
