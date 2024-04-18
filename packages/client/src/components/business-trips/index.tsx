import { ReactElement, useMemo } from 'react';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, Container, Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../gql/fragment-masking.js';
import { BusinessTripsScreenDocument, BusinessTripWrapperFragmentDoc } from '../../gql/graphql.js';
import { AccounterLoader, InsertBusinessTripModal } from '../common';
import { EditableBusinessTrip } from './editable-business-trip.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTripsScreen {
    allBusinessTrips {
      id
      name
      dates {
        start
      }
      ...BusinessTripWrapper
    }
  }
`;

export const BusinessTrips = (): ReactElement => {
  const [{ data, fetching }] = useQuery({
    query: BusinessTripsScreenDocument,
  });

  return fetching ? (
    <AccounterLoader />
  ) : (
    <Container>
      <Accordion
        className="w-full"
        multiple
        chevron={<Plus size="1rem" />}
        styles={{
          chevron: {
            '&[data-rotate]': {
              transform: 'rotate(45deg)',
            },
          },
        }}
      >
        {data?.allBusinessTrips
          .sort((a, b) => {
            // sort by start date (if available, newest top) and then by name
            if (a.dates?.start && b.dates?.start) {
              return a.dates.start < b.dates.start ? 1 : -1;
            }
            if (a.dates?.start) return -1;
            if (b.dates?.start) return 1;
            return a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase() ? -1 : 1;
          })
          .map(businessTrip => (
            <BusinessTripWrapper data={businessTrip} isFetching={fetching} key={businessTrip.id} />
          ))}
      </Accordion>
      <div className="flex justify-end mx-4">
        <InsertBusinessTripModal />
      </div>
    </Container>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripWrapper on BusinessTrip {
    id
    name
    uncategorizedTransactions {
      ... on Transaction @defer {
        id
      }
    }
    summary {
      ... on BusinessTripSummary @defer {
        errors
      }
    }
    ...EditableBusinessTrip
  }
`;

type BusinessTripWrapperProps = {
  data: FragmentType<typeof BusinessTripWrapperFragmentDoc>;
  isFetching?: boolean;
};

const BusinessTripWrapper = ({ data, isFetching }: BusinessTripWrapperProps): ReactElement => {
  const trip = getFragmentData(BusinessTripWrapperFragmentDoc, data);

  const indicatorUp = useMemo(() => {
    return trip && (trip.uncategorizedTransactions?.length || trip.summary?.errors?.length);
  }, [trip]);

  return (
    <Accordion.Item value={trip.id}>
      <Accordion.Control>
        <Indicator
          inline
          size={12}
          processing={isFetching}
          disabled={!isFetching && !indicatorUp}
          color={isFetching ? 'yellow' : 'red'}
          zIndex="auto"
        >
          {trip.name}
        </Indicator>
      </Accordion.Control>
      <Accordion.Panel>
        <EditableBusinessTrip data={trip} isExtended key={trip.id} />
      </Accordion.Panel>
    </Accordion.Item>
  );
};
