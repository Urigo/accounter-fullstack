import { type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { ChargeMatchesTable } from '@/components/charge-matches/index.js';
import { Accordion } from '@mantine/core';
import { ChargeMatchesDocument } from '../../../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeMatches($chargeId: UUID!) {
    findChargeMatches(chargeId: $chargeId) {
      matches {
        chargeId
        ...ChargeMatchesTableFields
      }
    }
  }
`;

type Props = {
  chargeId: string;
  toggleAccordionItem: (value: string) => void;
  isOpened?: boolean;
  onChange: () => void;
};

export const ChargeMatches = ({
  chargeId,
  toggleAccordionItem,
  isOpened,
  onChange,
}: Props): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: ChargeMatchesDocument,
    variables: {
      chargeId,
    },
    pause: !isOpened,
  });

  return (
    <Accordion.Item value="charges-matches">
      <Accordion.Control onClick={() => toggleAccordionItem('charges-matches')}>
        Charge Matches
      </Accordion.Control>
      <Accordion.Panel>
        {fetching ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <ChargeMatchesTable
            originChargeId={chargeId}
            chargesProps={data?.findChargeMatches.matches}
            onChange={onChange}
          />
        )}
      </Accordion.Panel>
    </Accordion.Item>
  );
};
