import { ReactElement, useContext, useEffect } from 'react';
import { useMatch } from 'react-router-dom';
import { useQuery } from 'urql';
import { Container } from '@mantine/core';
import { BusinessTripScreenDocument } from '../../gql/graphql.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { AccounterLoader, PrintToPdfButton } from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { EditableBusinessTrip } from './editable-business-trip.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTripScreen($businessTripId: UUID!) {
    businessTrip(id: $businessTripId) {
      id
      name
      dates {
        start
      }
    }
  }
`;

type Props = {
  businessTripId?: string;
};

export const BusinessTrip = ({ businessTripId }: Props): ReactElement => {
  const match = useMatch('business-trips/:businessTripId');
  const { setFiltersContext } = useContext(FiltersContext);
  const id = businessTripId ?? match?.params.businessTripId ?? '';
  const [{ data, fetching }] = useQuery({
    query: BusinessTripScreenDocument,
    variables: {
      businessTripId: id,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <PrintToPdfButton filename="business_trip_report" />
      </div>,
    );
  }, [data, fetching, setFiltersContext]);

  return fetching || !data?.businessTrip ? (
    <AccounterLoader />
  ) : (
    <PageLayout
      title={`Business Trip: ${data.businessTrip.name}`}
      description="Manage business trip"
    >
      <Container className="mt-5">
        {id && <EditableBusinessTrip tripId={id} isExtended />}
      </Container>
    </PageLayout>
  );
};
