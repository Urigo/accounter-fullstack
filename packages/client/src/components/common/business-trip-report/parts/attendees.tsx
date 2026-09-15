import type { ReactElement } from 'react';
import { BusinessTripReportAttendeesFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
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
  onChange: () => void;
}

export const Attendees = ({ data, onChange }: Props): ReactElement => {
  const { attendees, id } = getFragmentData(BusinessTripReportAttendeesFieldsFragmentDoc, data);

  if (!attendees?.length) {
    return <AddAttendee businessTripId={id} onAdd={onChange} />;
  }

  return (
    <div className="flex flex-col gap-2 mt-5">
      <Table className="border">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Arrival Date</TableHead>
            <TableHead>Departure Date</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendees
            .sort((a, b) => (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase() ? 1 : -1))
            .map(attendee => (
              <AttendeeRow
                data={attendee}
                businessTripId={id}
                onChange={onChange}
                key={attendee.id}
              />
            ))}
          <TableRow>
            <TableCell colSpan={4}>
              <AddAttendee businessTripId={id} onAdd={onChange} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
