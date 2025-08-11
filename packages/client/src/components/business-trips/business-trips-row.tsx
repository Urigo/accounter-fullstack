import { useMemo, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { Accordion, Indicator } from '@mantine/core';
import {
  BusinessTripsRowFieldsFragmentDoc,
  BusinessTripsRowValidationDocument,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { EditableBusinessTrip } from './editable-business-trip.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripsRowFields on BusinessTrip {
    id
    name
    accountantApproval
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BusinessTripsRowValidation($id: UUID!) {
    businessTrip(id: $id) {
      id
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
`;

type BusinessTripWrapperProps = {
  data: FragmentType<typeof BusinessTripsRowFieldsFragmentDoc>;
  isOpened: boolean;
  shouldValidate: boolean;
};

export const BusinessTripsRow = ({
  data: tripData,
  isOpened,
  shouldValidate,
}: BusinessTripWrapperProps): ReactElement => {
  const trip = getFragmentData(BusinessTripsRowFieldsFragmentDoc, tripData);
  const [{ data, fetching }] = useQuery({
    pause: !shouldValidate,
    query: BusinessTripsRowValidationDocument,
    variables: { id: trip.id },
  });
  const isError = useMemo(() => {
    if (!shouldValidate) return false;
    return (
      data?.businessTrip &&
      (data.businessTrip.uncategorizedTransactions?.length ||
        data?.businessTrip.summary?.errors?.length)
    );
  }, [data]);

  const indicatorUp = isError || trip?.accountantApproval !== 'APPROVED';

  return (
    <Accordion.Item value={trip.id}>
      <Accordion.Control>
        <Indicator
          inline
          size={12}
          processing={fetching}
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
