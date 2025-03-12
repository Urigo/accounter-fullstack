import { ReactElement, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { Checkbox } from '@mantine/core';
import {
  FetchMultipleBusinessesDocument,
  FetchMultipleBusinessesQuery,
} from '../../../gql/graphql.js';
import { useMergeBusinesses } from '../../../hooks/use-merge-businesses.js';
import { AccounterLoader } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchMultipleBusinesses($businessIds: [UUID!]!) {
    businesses(ids: $businessIds) {
      id
      name
    }
  }
`;

interface Props {
  businessIds: string[];
  onDone: () => void;
  resetMerge: () => void;
}

export function MergeBusinessesSelectionForm({
  businessIds,
  onDone,
  resetMerge,
}: Props): ReactElement {
  const { mergeBusinesses, fetching: merging } = useMergeBusinesses();
  const distinctBusinessIDs = Array.from(new Set(businessIds));
  const [{ data, fetching }] = useQuery({
    query: FetchMultipleBusinessesDocument,
    variables: { businessIds: distinctBusinessIDs },
  });

  const [mainBusiness, setMainBusiness] = useState<
    FetchMultipleBusinessesQuery['businesses'][number] | undefined
  >(data?.businesses[0]);

  const errorMessage =
    (data?.businesses.length !== distinctBusinessIDs.length && 'Some businesses were not Found') ||
    undefined;

  const businesses = data?.businesses || [];

  const onMergeBusinesses = useCallback(async () => {
    if (!mainBusiness) {
      toast.error('Error', {
        description: 'No main business selected',
      });
      return;
    }
    if (distinctBusinessIDs.length < 2) {
      toast.error('Error', {
        description: 'At least 2 businesses are required to execute a merge',
      });
      return;
    }

    await mergeBusinesses({
      targetBusinessId: mainBusiness.id,
      businessIdsToMerge: distinctBusinessIDs.filter(id => id !== mainBusiness.id),
    });
    resetMerge();
    return onDone();
  }, [mainBusiness, distinctBusinessIDs, mergeBusinesses, onDone, resetMerge]);

  return (
    <>
      {fetching && (
        <div className="flex flex-col text-center w-full mb-1">
          <AccounterLoader />
        </div>
      )}
      {!fetching && errorMessage && (
        <div className="flex flex-col text-center w-full mb-1">
          <h3 className="sm:text-2xl text-xl font-medium title-font mb-6 text-gray-900">
            {errorMessage}
          </h3>
        </div>
      )}
      {!fetching && !errorMessage && (
        <>
          <table>
            <tr>
              <th>Main</th>
              {businesses.map(business => (
                <td key={business.id}>
                  <div className="flex items-center justify-center mx-2 px-2 py-2 border-2 border-b-0 rounded-t-xl">
                    <Checkbox
                      checked={business.id === mainBusiness?.id}
                      size="xl"
                      onClick={(): void => {
                        setMainBusiness(business);
                      }}
                    />
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <th>Name</th>
              {businesses.map(business => (
                <td key={business.id}>{business.name}</td>
              ))}
            </tr>
          </table>
          <div className="flex justify-center gap-5 mt-5">
            <button
              type="button"
              className=" text-white bg-blue-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-blue-600 rounded-sm text-lg"
              disabled={fetching || merging}
              onClick={onMergeBusinesses}
            >
              Accept
            </button>
            <button
              type="button"
              className=" text-white bg-red-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-red-600 rounded-sm text-lg"
              onClick={onDone}
            >
              Cancel
            </button>
            <button
              type="button"
              className=" text-white bg-red-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-red-600 rounded-sm text-lg"
              onClick={(): void => {
                resetMerge();
                onDone();
              }}
            >
              Reset Merge
            </button>
          </div>
        </>
      )}
    </>
  );
}
