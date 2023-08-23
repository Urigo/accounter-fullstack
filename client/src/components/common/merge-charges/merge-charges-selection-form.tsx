import { ReactElement, useCallback, useState } from 'react';
import { SquareCheck, SquareX } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Checkbox } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { AccounterLoader, ListCapsule } from '..';
import {
  FetchMultipleChargesDocument,
  FetchMultipleChargesQuery,
  UpdateChargeInput,
} from '../../../gql/graphql.js';
import { useMergeCharges } from '../../../hooks/use-merge-charges';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchMultipleCharges($chargeIds: [ID!]!) {
    chargesByIDs(chargeIDs: $chargeIds) {
      id
      metadata {
        transactionsCount
        invoicesCount
      }
      owner {
        id
        name
      }
      tags {
        name
      }
      conversion
      property
      userDescription
    }
  }
`;

interface Props {
  chargeIds: string[];
  onDone: () => void;
  resetMerge: () => void;
}

export function MergeChargesSelectionForm({ chargeIds, onDone, resetMerge }: Props): ReactElement {
  const { mergeCharges, fetching: merging } = useMergeCharges();
  const distinctChargeIDs = Array.from(new Set(chargeIds));
  const [{ data, fetching }] = useQuery({
    query: FetchMultipleChargesDocument,
    variables: { chargeIds: distinctChargeIDs },
  });

  const [mainCharge, setMainCharge] = useState<
    FetchMultipleChargesQuery['chargesByIDs'][number] | undefined
  >(data?.chargesByIDs[0]);
  const [selectedDescription, setSelectedDescription] = useState<
    { id: string; value: string } | undefined
  >(undefined);
  const [selectedOwner, setSelectedOwner] = useState<{ id: string; value: string } | undefined>(
    undefined,
  );
  const [selectedProperty, setSelectedProperty] = useState<
    { id: string; value: boolean } | undefined
  >(undefined);
  const [selectedConversion, setSelectedConversion] = useState<
    { id: string; value: boolean } | undefined
  >(undefined);
  const [selectedTags, setSelectedTags] = useState<{ id: string; value: string } | undefined>(
    undefined,
  );

  const errorMessage =
    (data?.chargesByIDs.length !== distinctChargeIDs.length && 'Some charges were not Found') ||
    undefined;

  const charges = data?.chargesByIDs || [];

  const onMergeCharges = useCallback(async () => {
    if (!mainCharge) {
      showNotification({
        message: 'No main charge selected',
        color: 'red',
      });
      return;
    }
    if (distinctChargeIDs.length < 2) {
      showNotification({
        message: 'At least 2 charges are required to execute a merge',
        color: 'red',
      });
      return;
    }

    let fields: UpdateChargeInput | undefined = undefined;
    if (selectedDescription && selectedDescription.value !== mainCharge.userDescription) {
      fields ??= {};
      fields = {
        ...fields,
        userDescription: selectedDescription.value,
      };
    }
    if (selectedOwner && selectedOwner.value !== mainCharge.owner.id) {
      fields ??= {};
      fields = {
        ...fields,
        ownerId: selectedOwner.value,
      };
    }
    if (selectedConversion && selectedConversion.value !== mainCharge.conversion) {
      fields ??= {};
      fields = {
        ...fields,
        isConversion: selectedConversion.value,
      };
    }
    if (selectedProperty && selectedProperty.value !== mainCharge.property) {
      fields ??= {};
      fields = {
        ...fields,
        isProperty: selectedProperty.value,
      };
    }
    if (selectedTags && selectedTags.value !== mainCharge.tags.map(tag => tag.name).join(',')) {
      fields ??= {};
      fields = {
        ...fields,
        tags: selectedTags.value
          .split(',')
          .filter(t => t !== '')
          .map(tag => ({ name: tag })),
      };
    }
    await mergeCharges({
      baseChargeID: mainCharge.id,
      chargeIdsToMerge: distinctChargeIDs.filter(id => id !== mainCharge.id),
      fields,
    });
    return onDone();
  }, [
    mainCharge,
    distinctChargeIDs,
    mergeCharges,
    selectedDescription,
    selectedOwner,
    selectedConversion,
    selectedProperty,
    selectedTags,
    onDone,
  ]);

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
              {charges.map(charge => (
                <td key={charge.id}>
                  <div className="flex items-center justify-center mx-2 px-2 py-2 border-2 border-b-0 rounded-t-xl">
                    <Checkbox
                      checked={charge.id === mainCharge?.id}
                      size="xl"
                      onClick={(): void => {
                        setMainCharge(charge);
                        setSelectedDescription({
                          id: charge.id,
                          value: charge.userDescription ?? '',
                        });
                        setSelectedOwner({
                          id: charge.id,
                          value: charge.owner.id,
                        });
                        setSelectedProperty({
                          id: charge.id,
                          value: charge.property ?? false,
                        });
                        setSelectedConversion({
                          id: charge.id,
                          value: charge.conversion ?? false,
                        });
                        setSelectedTags({
                          id: charge.id,
                          value: (charge.tags.map(tag => tag.name) ?? []).join(','),
                        });
                      }}
                    />
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <th>Description</th>
              {charges.map(charge => (
                <td key={charge.id}>
                  <button
                    className="w-full px-2"
                    disabled={
                      !charge.userDescription ||
                      selectedDescription?.value === charge.userDescription
                    }
                    onClick={(): void =>
                      setSelectedDescription({
                        id: charge.id,
                        value: charge.userDescription ?? '',
                      })
                    }
                  >
                    <div
                      className="flex items-center justify-center px-2 py-2 border-x-2"
                      style={
                        selectedDescription?.id === charge.id ? { background: '#228be633' } : {}
                      }
                    >
                      {charge.userDescription}
                    </div>
                  </button>
                </td>
              ))}
            </tr>
            <tr>
              <th>Owner</th>
              {charges.map(charge => (
                <td key={charge.id}>
                  <button
                    className="w-full px-2"
                    disabled={selectedOwner?.value === charge.owner.id}
                    onClick={(): void =>
                      setSelectedOwner({
                        id: charge.id,
                        value: charge.owner.id,
                      })
                    }
                  >
                    <div
                      className="flex items-center justify-center px-2 py-2 border-x-2"
                      style={selectedOwner?.id === charge.id ? { background: '#228be633' } : {}}
                    >
                      {charge.owner.name}
                    </div>
                  </button>
                </td>
              ))}
            </tr>
            <tr>
              <th>Is Property</th>
              {charges.map(charge => (
                <td key={charge.id}>
                  <button
                    className="w-full px-2"
                    disabled={
                      charge.property == null || charge.property === selectedProperty?.value
                    }
                    onClick={(): void => {
                      setSelectedProperty({
                        id: charge.id,
                        value: charge.property ?? false,
                      });
                    }}
                  >
                    <div
                      className="flex items-center justify-center px-2 py-2 border-x-2"
                      style={selectedProperty?.id === charge.id ? { background: '#228be633' } : {}}
                    >
                      {charge.property ? (
                        <SquareCheck size={20} color="green" />
                      ) : (
                        <SquareX size={20} color="red" />
                      )}
                    </div>
                  </button>
                </td>
              ))}
            </tr>
            <tr>
              <th>Is Conversion</th>
              {charges.map(charge => (
                <td key={charge.id}>
                  <button
                    className="w-full px-2"
                    disabled={
                      charge.conversion == null || charge.conversion === selectedConversion?.value
                    }
                    onClick={(): void => {
                      setSelectedConversion({
                        id: charge.id,
                        value: charge.conversion ?? false,
                      });
                    }}
                  >
                    <div
                      className="flex items-center justify-center px-2 py-2 border-x-2"
                      style={
                        selectedConversion?.id === charge.id ? { background: '#228be633' } : {}
                      }
                    >
                      {charge.conversion ? (
                        <SquareCheck size={20} color="green" />
                      ) : (
                        <SquareX size={20} color="red" />
                      )}
                    </div>
                  </button>
                </td>
              ))}
            </tr>
            <tr>
              <th>Tags</th>
              {charges.map(charge => (
                <td key={charge.id}>
                  <button
                    className="w-full px-2"
                    disabled={
                      charge.tags == null ||
                      charge.tags.map(tag => tag.name).join(',') === selectedTags?.value
                    }
                    onClick={(): void => {
                      setSelectedTags({
                        id: charge.id,
                        value: (charge.tags.map(tag => tag.name) ?? []).join(','),
                      });
                    }}
                  >
                    <div
                      className="flex items-center justify-center px-2 py-2 border-x-2"
                      style={
                        selectedConversion?.id === charge.id ? { background: '#228be633' } : {}
                      }
                    >
                      <ListCapsule items={charge.tags.map(t => t.name)} />
                    </div>
                  </button>
                </td>
              ))}
            </tr>
            <tr>
              <th>Transactions</th>
              {charges.map(charge => (
                <td key={charge.id}>
                  <div className="flex items-center justify-center mx-2 px-2 py-2 border-x-2">
                    {charge.metadata?.transactionsCount ?? 0}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <th>Invoices</th>
              {charges.map(charge => (
                <td key={charge.id}>
                  <div className="flex items-center justify-center mx-2 px-2 py-2 border-2 border-t-0 rounded-b-xl">
                    {charge.metadata?.invoicesCount ?? 0}
                  </div>
                </td>
              ))}
            </tr>
          </table>
          <div className="flex justify-center gap-5 mt-5">
            <button
              type="button"
              className=" text-white bg-blue-500 border-0 py-2 px-8 focus:outline-none hover:bg-blue-600 rounded text-lg"
              disabled={fetching || merging}
              onClick={onMergeCharges}
            >
              Accept
            </button>
            <button
              type="button"
              className=" text-white bg-red-500 border-0 py-2 px-8 focus:outline-none hover:bg-red-600 rounded text-lg"
              onClick={onDone}
            >
              Cancel
            </button>
            <button
              type="button"
              className=" text-white bg-red-500 border-0 py-2 px-8 focus:outline-none hover:bg-red-600 rounded text-lg"
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

// state for selected base charge
// execute merge mutation
