import type { ReactElement } from 'react';
import {
  SecurityDescriptorFieldsFragmentDoc,
  type SecurityDescriptorFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { Badge } from '../ui/badge.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SecurityDescriptorFields on SecurityBusiness {
    id
    isin
    exchange
    currencyCode
    itemType
    stockType
    isEtf
    isForeign
  }
`;

interface Props {
  security: FragmentType<typeof SecurityDescriptorFieldsFragmentDoc>;
  /** Drop the ISIN badge where the ISIN already has a column of its own. */
  withIsin?: boolean;
}

/**
 * The descriptor badges of a security, shared by its own page and the holdings table so the
 * two always read the same. Identity facts get `secondary`, classification gets `outline`.
 */
export function SecurityDescriptorBadges({ security, withIsin = true }: Props): ReactElement {
  const descriptors: SecurityDescriptorFieldsFragment = getFragmentData(
    SecurityDescriptorFieldsFragmentDoc,
    security,
  );

  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      {withIsin && <Badge variant="secondary">{descriptors.isin}</Badge>}
      {descriptors.exchange && <Badge variant="secondary">{descriptors.exchange}</Badge>}
      {descriptors.currencyCode && <Badge variant="secondary">{descriptors.currencyCode}</Badge>}
      {descriptors.itemType && <Badge variant="outline">{descriptors.itemType}</Badge>}
      {descriptors.stockType && <Badge variant="outline">{descriptors.stockType}</Badge>}
      {descriptors.isEtf && <Badge variant="outline">ETF</Badge>}
      {descriptors.isForeign && <Badge variant="outline">Foreign</Badge>}
    </div>
  );
}
