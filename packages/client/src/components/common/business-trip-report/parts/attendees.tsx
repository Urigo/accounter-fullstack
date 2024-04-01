import { ReactElement } from 'react';
import { List, Title } from '@mantine/core';
import { BusinessTripReportAttendeesFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAttendeesFields on BusinessTrip {
    id
    attendees {
      id
      name
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportAttendeesFieldsFragmentDoc>;
}

export const Attendees = ({ data }: Props): ReactElement => {
  const { attendees } = getFragmentData(BusinessTripReportAttendeesFieldsFragmentDoc, data);

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Title order={5}>Attendees</Title>
      <List>
        {attendees.map(attendee => (
          <List.Item key={attendee.id}>{attendee.name}</List.Item>
        ))}
      </List>
    </div>
  );
};
