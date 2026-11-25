import { useCallback, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { ChargeDepreciationDisposalsDocument } from '../../../gql/graphql.js';
import { AccounterBarSpinner } from '../../ui/accounter-spinner.js';
import { DepreciationDisposalsList } from './depreciation-disposals-list.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeDepreciationDisposals($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ... on CommonCharge {
        depreciationDisposals {
          id
          ...DepreciationDisposalFields
        }
      }
    }
  }
`;

type Props = {
  chargeId: string;
  onChange?: () => void;
};

/** The asset disposals and cost refunds a sale / refund charge carries the money for */
export function ChargeDepreciationDisposals({ chargeId, onChange }: Props): ReactElement {
  const [{ data, fetching }, refetch] = useQuery({
    query: ChargeDepreciationDisposalsDocument,
    variables: { chargeId },
  });

  const onDisposalsChange = useCallback(() => {
    refetch({ requestPolicy: 'network-only' });
    onChange?.();
  }, [refetch, onChange]);

  if (fetching) {
    return <AccounterBarSpinner className="self-center" />;
  }
  const disposals =
    data?.charge && 'depreciationDisposals' in data.charge ? data.charge.depreciationDisposals : [];
  return <DepreciationDisposalsList disposals={disposals} showAsset onChange={onDisposalsChange} />;
}
