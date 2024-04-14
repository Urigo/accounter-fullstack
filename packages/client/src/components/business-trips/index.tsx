import { ReactElement } from 'react';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, Container } from '@mantine/core';
import { BusinessTripsScreenDocument } from '../../gql/graphql.js';
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
      ...EditableBusinessTrip
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
            <EditableBusinessTrip
              data={businessTrip}
              isFetching={fetching}
              isExtended
              key={businessTrip.id}
            />
          ))}
      </Accordion>
      <div className="flex justify-end mx-4">
        <InsertBusinessTripModal />
      </div>
    </Container>
  );
};
