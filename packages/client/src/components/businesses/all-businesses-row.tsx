import { ReactElement, useState } from 'react';
import { PanelTopClose, PanelTopOpen } from 'lucide-react';
import { Paper } from '@mantine/core';
import {
  AllBusinessesForScreenQuery,
  AllBusinessesRowFieldsFragment,
  AllBusinessesRowFieldsFragmentDoc,
} from '../../gql/graphql.js';
import { getFragmentData } from '../../gql/index.js';
import { BusinessCard, ToggleMergeSelected } from '../common/index.js';
import { Button } from '../ui/button.js';
import { HebrewName } from './cells/hebrew-name.js';
import { Name } from './cells/name.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllBusinessesRowFields on LtdFinancialEntity {
    id
    ...AllBusinessesNameFields
    ...AllBusinessesHebrewNameFields
  }
`;

interface Props {
  data: Extract<
    NonNullable<AllBusinessesForScreenQuery['allBusinesses']>['nodes'][number],
    { __typename: 'LtdFinancialEntity' }
  >;
  isAllOpened: boolean;
  toggleMergeBusiness?: (onChange: () => void) => void;
  isSelectedForMerge: boolean;
}

export const AllBusinessesRow = ({
  data,
  isAllOpened,
  toggleMergeBusiness,
  isSelectedForMerge,
}: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const [business, setBusiness] = useState<AllBusinessesRowFieldsFragment>(
    getFragmentData(AllBusinessesRowFieldsFragmentDoc, data),
  );

  return (
    <>
      <tr>
        <Name data={business} />
        <HebrewName data={business} />
        <td>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-7.5"
              onClick={(): void => {
                setOpened(i => !i);
              }}
            >
              {isAllOpened || opened ? (
                <PanelTopClose className="size-5" />
              ) : (
                <PanelTopOpen className="size-5" />
              )}
            </Button>

            {toggleMergeBusiness && (
              <ToggleMergeSelected
                toggleMergeSelected={(): void => toggleMergeBusiness(() => {})}
                mergeSelected={isSelectedForMerge}
              />
            )}
          </div>
        </td>
      </tr>
      {(isAllOpened || opened) && (
        <tr>
          <td colSpan={12}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              <BusinessCard businessID={business.id} updateBusiness={setBusiness} />
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
};
