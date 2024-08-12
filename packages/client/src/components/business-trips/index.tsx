import { ReactElement, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, Container, Indicator } from '@mantine/core';
import { BusinessTripsScreenDocument, BusinessTripsScreenQuery } from '../../gql/graphql.js';
import { InsertBusinessTripModal } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
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
      ... on BusinessTrip @defer {
        accountantApproval
        uncategorizedTransactions {
          transaction {
            ... on Transaction @defer {
              id
            }
          }
        }
        summary {
          ... on BusinessTripSummary @defer {
            errors
          }
        }
      }
    }
  }
`;

export const BusinessTrips = (): ReactElement => {
  const [businessTrips, setBusinessTrips] = useState<BusinessTripsScreenQuery['allBusinessTrips']>(
    [],
  );
  const [{ data, fetching }] = useQuery({
    query: BusinessTripsScreenDocument,
  });

  useEffect(() => {
    if (!data?.allBusinessTrips?.length) {
      setBusinessTrips([]);
      return;
    }

    const newBusinessTrips = data.allBusinessTrips.sort((a, b) => {
      // sort by start date (if available, newest top) and then by name
      if (a.dates?.start && b.dates?.start) {
        return a.dates.start < b.dates.start ? 1 : -1;
      }
      if (a.dates?.start) return -1;
      if (b.dates?.start) return 1;
      return a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase() ? -1 : 1;
    });
    setBusinessTrips(newBusinessTrips);
  }, [data?.allBusinessTrips]);

  const [openedTrips, setOpenedTrips] = useState<string[]>([]);

  return (
    <PageLayout title="Business Trips" description="Manage business trips">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <Container>
          <Accordion
            className="w-full"
            multiple
            value={openedTrips}
            onChange={setOpenedTrips}
            chevron={<Plus size="1rem" />}
            styles={{
              chevron: {
                '&[data-rotate]': {
                  transform: 'rotate(45deg)',
                },
              },
            }}
          >
            {businessTrips?.map(businessTrip => (
              <BusinessTripWrapper
                trip={businessTrip}
                isFetching={fetching}
                key={businessTrip.id}
                isOpened={openedTrips.includes(businessTrip.id)}
              />
            ))}
          </Accordion>
          <div className="flex justify-end mx-4">
            <InsertBusinessTripModal />
          </div>
        </Container>
      )}
    </PageLayout>
  );
};

type BusinessTripWrapperProps = {
  trip: BusinessTripsScreenQuery['allBusinessTrips'][number];
  isFetching?: boolean;
  isOpened: boolean;
};

const BusinessTripWrapper = ({
  trip,
  isFetching,
  isOpened,
}: BusinessTripWrapperProps): ReactElement => {
  const isError = useMemo(() => {
    return trip && (trip.uncategorizedTransactions?.length || trip.summary?.errors?.length);
  }, [trip]);

  const indicatorUp = isError || !trip?.accountantApproval;

  return (
    <Accordion.Item value={trip.id}>
      <Accordion.Control>
        <Indicator
          inline
          size={12}
          processing={isFetching}
          disabled={!indicatorUp}
          color={isError ? 'red' : 'yellow'}
          zIndex="auto"
        >
          {trip.name}
        </Indicator>
      </Accordion.Control>
      <Accordion.Panel>
        {isOpened && <EditableBusinessTrip tripId={trip.id} isExtended key={trip.id} />}
      </Accordion.Panel>
    </Accordion.Item>
  );
};
