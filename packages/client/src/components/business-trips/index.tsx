import { useContext, useEffect, useState, type ReactElement } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useQuery } from 'urql';
import { Accordion, Container, Tooltip } from '@mantine/core';
import {
  BusinessTripsRowFieldsFragmentDoc,
  BusinessTripsScreenDocument,
  type BusinessTripsScreenQuery,
} from '../../gql/graphql.js';
import type { FragmentType } from '../../gql/index.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { InsertBusinessTripModal, PrintToPdfButton } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { Switch } from '../ui/switch.js';
import { BusinessTripsRow } from './business-trips-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTripsScreen {
    allBusinessTrips {
      id
      name
      dates {
        start
      }
      ...BusinessTripsRowFields
    }
  }
`;

export const BusinessTrips = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [businessTrips, setBusinessTrips] = useState<BusinessTripsScreenQuery['allBusinessTrips']>(
    [],
  );
  const [shouldValidate, setShouldValidate] = useState(false);
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

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <InsertBusinessTripModal />
        <Tooltip label="Toggle business trips validation">
          <div className="flex flex-row items-center gap-x-2">
            <Switch
              checked={shouldValidate ?? false}
              onCheckedChange={(checked): void => setShouldValidate(checked)}
            />
            <span className="text-sm text-gray-500">Validate</span>
          </div>
        </Tooltip>
        <PrintToPdfButton filename="business_trips" />
      </div>,
    );
  }, [data, fetching, setFiltersContext, shouldValidate]);

  return (
    <PageLayout title="Business Trips" description="Manage business trips">
      {businessTrips.length === 0 && fetching ? (
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
            {businessTrips?.map(businessTrip => {
              return (
                <BusinessTripsRow
                  key={businessTrip.id}
                  data={
                    businessTrips.find(trip => trip.id === businessTrip.id) as FragmentType<
                      typeof BusinessTripsRowFieldsFragmentDoc
                    >
                  }
                  shouldValidate={shouldValidate}
                  isOpened={openedTrips.includes(businessTrip.id)}
                />
              );
            })}
          </Accordion>
        </Container>
      )}
    </PageLayout>
  );
};
