import { useQuery } from 'urql';
import { DocumentsToChargeMatcherDocument } from '../../gql/graphql';
import { AccounterLoader } from '../common';
import { SelectionHandler } from './selection-handler';

/* GraphQL */ `
  query DocumentsToChargeMatcher($chargeId: ID!) {
    documents {
      id
      ...DocumentsToMatchFields
    }
    chargeById(id: $chargeId) {
      id
      transactions {
        id
        createdAt
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
    variables: { chargeId },
  });

  const errorMessage =
    (data?.documents.length === 0 && 'No Document Found') ||
    (!data?.chargeById && 'Charge was not found') ||
    (data?.chargeById.totalAmount?.raw == null && 'Charge is missing amount') ||
    (!data?.chargeById.transactions[0]?.createdAt && 'Charge is missing date') ||
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
              chargeProps={data!.chargeById}
              documentsProps={data}
              onDone={onDone}
            />
          </div>
        )}
      </div>
    </div>
  );
}
