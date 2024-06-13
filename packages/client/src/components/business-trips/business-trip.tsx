import { ReactElement } from 'react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Container } from '@mantine/core';
import { graphql } from '../../graphql.js';
import { AccounterLoader } from '../common/index.js';
import { EditableBusinessTrip } from './editable-business-trip.jsx';

export const BusinessTripScreenDocument = graphql(`
  query BusinessTripScreen($businessTripId: UUID!) {
    businessTrip(id: $businessTripId) {
      id
      name
      dates {
        start
      }
      ...EditableBusinessTrip
    }
  }
`);

type Props = {
  businessTripId?: string;
};

export const BusinessTrip = ({ businessTripId }: Props): ReactElement => {
  const match = useMatch('business-trips/:businessTripId');
  const id = businessTripId || match?.params.businessTripId;
  const [{ data, fetching }] = useQuery({
    query: BusinessTripScreenDocument,
    variables: {
      businessTripId: id,
    },
  });

  return fetching || !data?.businessTrip ? (
    <AccounterLoader />
  ) : (
    <Container className="mt-5">
      <EditableBusinessTrip data={data.businessTrip} isExtended />
    </Container>
  );
};
