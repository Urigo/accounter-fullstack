import { ReactElement } from 'react';
import { Table } from '@mantine/core';
import { BusinessTripReportAttendeesFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { AddAttendee } from '../buttons/add-attendee.js';
import { AttendeeRow } from './attendee-row.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportAttendeesFields on BusinessTrip {
    id
    attendees {
      id
      name
      ...BusinessTripReportAttendeeRowFields
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportAttendeesFieldsFragmentDoc>;
  onChange?: () => void;
}

export const Attendees = ({ data, onChange }: Props): ReactElement => {
  const { attendees, id } = getFragmentData(BusinessTripReportAttendeesFieldsFragmentDoc, data);

  if (!attendees.length) {
    return <AddAttendee businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table highlightOnHover withBorder>
        <thead>
          <tr>
            <th>Name</th>
            <th>Arrival Date</th>
            <th>Departure Date</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {attendees
            .sort((a, b) => (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase() ? 1 : -1))
            .map(attendee => (
              <AttendeeRow data={attendee} businessTripId={id} key={attendee.id} />
            ))}
          <tr>
            <td colSpan={4}>
              <AddAttendee businessTripId={id} onAdd={onChange} />
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};
