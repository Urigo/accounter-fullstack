import { useEffect, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { Card } from '@mantine/core';
import { EditableBusinessTripDocument, type EditableBusinessTripQuery } from '../../gql/graphql.js';
import { Accommodations } from '../common/business-trip-report/parts/accommodations.js';
import { Attendees } from '../common/business-trip-report/parts/attendees.js';
import { CarRental } from '../common/business-trip-report/parts/car-rental.js';
import { Flights } from '../common/business-trip-report/parts/flights.js';
import { Other } from '../common/business-trip-report/parts/other.js';
import { ReportHeader } from '../common/business-trip-report/parts/report-header.js';
import { Summary } from '../common/business-trip-report/parts/summary.js';
import { TravelAndSubsistence } from '../common/business-trip-report/parts/travel-and-subsistence.js';
import { UncategorizedTransactions } from '../common/business-trip-report/parts/uncategorized-transactions.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditableBusinessTrip($businessTripId: UUID!) {
    businessTrip(id: $businessTripId) {
      id
      ...BusinessTripReportHeaderFields
      ...BusinessTripReportAttendeesFields
      ...BusinessTripUncategorizedTransactionsFields
      ...BusinessTripReportFlightsFields
      ...BusinessTripReportAccommodationsFields
      ...BusinessTripReportTravelAndSubsistenceFields
      ...BusinessTripReportCarRentalFields
      ...BusinessTripReportOtherFields
      ...BusinessTripReportSummaryFields
      ... on BusinessTrip {
        uncategorizedTransactions {
          transaction {
            id
          }
        }
      }
    }
  }
`;

interface Props {
  tripId: string;
  isExtended?: boolean;
}

export function EditableBusinessTrip({ tripId, isExtended = false }: Props): ReactElement {
  const [trip, setTrip] = useState<EditableBusinessTripQuery['businessTrip']>();
  const [{ data: updatedTripDate }, fetchUpdatedBusinessTrip] = useQuery({
    query: EditableBusinessTripDocument,
    variables: {
      businessTripId: tripId,
    },
  });

  const onChangeDo = fetchUpdatedBusinessTrip;

  useEffect(() => {
    if (updatedTripDate?.businessTrip) {
      setTrip(updatedTripDate.businessTrip);
    }
  }, [updatedTripDate?.businessTrip]);

  return (
    <Card shadow="sm" radius="md" withBorder>
      {trip ? (
        <>
          <ReportHeader data={trip} onChange={onChangeDo} />
          <Accordion className="w-full" type="multiple">
            <AccordionItem value="attendees">
              <AccordionTrigger>Attendees</AccordionTrigger>
              <AccordionContent>
                <Attendees data={trip} onChange={onChangeDo} />
              </AccordionContent>
            </AccordionItem>

            {isExtended && (
              <AccordionItem value="uncategorized-transactions">
                <AccordionTrigger disabled={!trip.uncategorizedTransactions?.length}>
                  Uncategorized Transactions
                </AccordionTrigger>
                <AccordionContent>
                  <UncategorizedTransactions data={trip} onChange={onChangeDo} />
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="flights">
              <AccordionTrigger>Flights</AccordionTrigger>
              <AccordionContent>
                <Flights data={trip} onChange={onChangeDo} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="accommodations">
              <AccordionTrigger>Accommodations</AccordionTrigger>
              <AccordionContent>
                <Accommodations data={trip} onChange={onChangeDo} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="travelAndSubsistence">
              <AccordionTrigger>Travel & Subsistence</AccordionTrigger>
              <AccordionContent>
                <TravelAndSubsistence data={trip} onChange={onChangeDo} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="other">
              <AccordionTrigger>Other</AccordionTrigger>
              <AccordionContent>
                <Other data={trip} onChange={onChangeDo} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="carRental">
              <AccordionTrigger>Car Rental</AccordionTrigger>
              <AccordionContent>
                <CarRental data={trip} onChange={onChangeDo} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="summary">
              <AccordionTrigger>Summary</AccordionTrigger>
              <AccordionContent>
                <Summary data={trip} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      ) : (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      )}
    </Card>
  );
}
