import { type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { ChargeMatchesTable } from '@/components/charge-matches/index.js';
import { ChargeMatchesDocument } from '../../../gql/graphql.js';
import { AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion.js';

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
  isOpened?: boolean;
  onChange: () => void;
};

export const ChargeMatches = ({ chargeId, isOpened, onChange }: Props): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: ChargeMatchesDocument,
    variables: {
      chargeId,
    },
    pause: !isOpened,
  });

  return (
    <AccordionItem value="charges-matches">
      <AccordionTrigger>Charge Matches</AccordionTrigger>
      <AccordionContent>
        {fetching ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <ChargeMatchesTable
            originChargeId={chargeId}
            chargesProps={data?.findChargeMatches.matches}
            onChange={onChange}
          />
        )}
      </AccordionContent>
    </AccordionItem>
  );
};
