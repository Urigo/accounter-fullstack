import { ReactElement } from 'react';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, Container } from '@mantine/core';
import { BusinessTripsScreenDocument } from '../../gql/graphql.js';
import { AccounterLoader } from '../common';
import { EditableBusinessTrip } from './editable-business-trip.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTripsScreen {
    allBusinessTrips {
      id
      name
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
        {data?.allBusinessTrips.map(businessTrip => (
          <Accordion.Item value={businessTrip.id} key={businessTrip.id}>
            <Accordion.Control>{businessTrip.name}</Accordion.Control>
            <Accordion.Panel>
              <EditableBusinessTrip data={businessTrip} />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
      {/* TODO: add business trip button + modal */}
    </Container>
  );
};
