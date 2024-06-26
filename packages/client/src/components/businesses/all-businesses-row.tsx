import { ReactElement, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { ActionIcon, Paper } from '@mantine/core';
import { AllBusinessesForScreenQuery, AllBusinessesRowFieldsFragment } from '../../gql/graphql.js';
import { getFragmentData } from '../../gql/index.js';
import { graphql } from '../../graphql.js';
import { BusinessCard } from '../common/index.js';
import { HebrewName } from './cells/hebrew-name.js';
import { Name } from './cells/name.js';

export const AllBusinessesRowFieldsFragmentDoc = graphql(`
  fragment AllBusinessesRowFields on LtdFinancialEntity {
    id
    ...AllBusinessesNameFields
    ...AllBusinessesHebrewNameFields
  }
`);

interface Props {
  data: Extract<
    NonNullable<AllBusinessesForScreenQuery['allBusinesses']>['nodes'][number],
    { __typename: 'LtdFinancialEntity' }
  >;
  isAllOpened: boolean;
}

export const AllBusinessesRow = ({ data, isAllOpened }: Props): ReactElement => {
  const [opened, setOpened] = useState(false);
  const [business, setBusiness] = useState<AllBusinessesRowFieldsFragment>(
    readFragment(AllBusinessesRowFieldsFragmentDoc, data),
  );

  return (
    <>
      <tr>
        <Name data={business} />
        <HebrewName data={business} />
        <td>
          <div className="flex flex-col gap-2">
            <ActionIcon
              variant="default"
              onClick={(): void => {
                setOpened(i => !i);
              }}
              size={30}
            >
              {isAllOpened || opened ? (
                <LayoutNavbarCollapse size={20} />
              ) : (
                <LayoutNavbarExpand size={20} />
              )}
            </ActionIcon>
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
