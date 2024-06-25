import { ReactElement, useEffect, useState } from 'react';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, Card } from '@mantine/core';
import { FragmentOf, graphql, readFragment, ResultOf } from '../../graphql.js';
import {
  Accommodations,
  Attendees,
  BusinessTripReportAccommodationsFieldsFragmentDoc,
  BusinessTripReportAttendeesFieldsFragmentDoc,
  BusinessTripReportFlightsFieldsFragmentDoc,
  BusinessTripReportHeaderFieldsFragmentDoc,
  BusinessTripReportOtherFieldsFragmentDoc,
  BusinessTripReportSummaryFieldsFragmentDoc,
  BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc,
  BusinessTripUncategorizedTransactionsFieldsFragmentDoc,
  Flights,
  Other,
  ReportHeader,
  Summary,
  TravelAndSubsistence,
  UncategorizedTransactions,
} from '../common/business-trip-report/parts/index.js';

export const EditableBusinessTripFragmentDoc = graphql(
  `
    fragment EditableBusinessTrip on BusinessTrip {
      id
      ...BusinessTripReportHeaderFields
      ...BusinessTripReportAttendeesFields
      ...BusinessTripUncategorizedTransactionsFields
      ...BusinessTripReportFlightsFields
      ...BusinessTripReportAccommodationsFields
      ...BusinessTripReportTravelAndSubsistenceFields
      ...BusinessTripReportOtherFields
      ...BusinessTripReportSummaryFields
      ... on BusinessTrip {
        uncategorizedTransactions {
          id
        }
      }
    }
  `,
  [
    BusinessTripReportHeaderFieldsFragmentDoc,
    BusinessTripReportAttendeesFieldsFragmentDoc,
    BusinessTripUncategorizedTransactionsFieldsFragmentDoc,
    BusinessTripReportFlightsFieldsFragmentDoc,
    BusinessTripReportAccommodationsFieldsFragmentDoc,
    BusinessTripReportTravelAndSubsistenceFieldsFragmentDoc,
    BusinessTripReportOtherFieldsFragmentDoc,
    BusinessTripReportSummaryFieldsFragmentDoc,
  ],
);

export const EditableBusinessTripDocument = graphql(
  `
    query EditableBusinessTrip($businessTripId: UUID!) {
      businessTrip(id: $businessTripId) {
        id
        ...EditableBusinessTrip
      }
    }
  `,
  [EditableBusinessTripFragmentDoc],
);

interface Props {
  data: FragmentOf<typeof EditableBusinessTripFragmentDoc>;
  isExtended?: boolean;
}

export function EditableBusinessTrip({ data, isExtended = false }: Props): ReactElement {
  const [trip, setTrip] = useState<ResultOf<typeof EditableBusinessTripFragmentDoc>>(
    readFragment(EditableBusinessTripFragmentDoc, data),
  );
  const [accordionItems, setAccordionItems] = useState<string[]>([]);
  const [{ data: updatedTripDate }, fetchUpdatedBusinessTrip] = useQuery({
    query: EditableBusinessTripDocument,
    variables: {
      businessTripId: trip.id,
    },
    pause: true,
  });

  function toggleAccordionItem(item: string): void {
    if (accordionItems.includes(item)) {
      setAccordionItems(current => current.filter(currItem => currItem !== item));
    } else {
      setAccordionItems(current => [...current, item]);
    }
  }

  const onChangeDo = fetchUpdatedBusinessTrip;

  useEffect(() => {
    if (updatedTripDate?.businessTrip) {
      setTrip(readFragment(EditableBusinessTripFragmentDoc, updatedTripDate.businessTrip));
    }
  }, [updatedTripDate?.businessTrip]);

  return (
    <Card shadow="sm" radius="md" withBorder>
      <ReportHeader data={trip} />
      <Accordion
        className="w-full"
        multiple
        value={accordionItems}
        chevron={<Plus size="1rem" />}
        styles={{
          chevron: {
            '&[data-rotate]': {
              transform: 'rotate(45deg)',
            },
          },
        }}
      >
        <Accordion.Item value="attendees">
          <Accordion.Control onClick={() => toggleAccordionItem('attendees')}>
            Attendees
          </Accordion.Control>
          <Accordion.Panel>
            <Attendees data={trip} onChange={onChangeDo} />
          </Accordion.Panel>
        </Accordion.Item>

        {isExtended && (
          <Accordion.Item value="uncategorized-transactions">
            <Accordion.Control
              onClick={() => toggleAccordionItem('uncategorized-transactions')}
              disabled={!trip.uncategorizedTransactions?.length}
            >
              Uncategorized Transactions
            </Accordion.Control>
            <Accordion.Panel>
              <UncategorizedTransactions data={trip} onChange={onChangeDo} />
            </Accordion.Panel>
          </Accordion.Item>
        )}

        <Accordion.Item value="flights">
          <Accordion.Control onClick={() => toggleAccordionItem('flights')}>
            Flights
          </Accordion.Control>
          <Accordion.Panel>
            <Flights data={trip} onChange={onChangeDo} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="accommodations">
          <Accordion.Control onClick={() => toggleAccordionItem('accommodations')}>
            Accommodations
          </Accordion.Control>
          <Accordion.Panel>
            <Accommodations data={trip} onChange={onChangeDo} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="travelAndSubsistence">
          <Accordion.Control onClick={() => toggleAccordionItem('travelAndSubsistence')}>
            Travel & Subsistence
          </Accordion.Control>
          <Accordion.Panel>
            <TravelAndSubsistence data={trip} onChange={onChangeDo} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="other">
          <Accordion.Control onClick={() => toggleAccordionItem('other')}>Other</Accordion.Control>
          <Accordion.Panel>
            <Other data={trip} onChange={onChangeDo} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="summary">
          <Accordion.Control onClick={() => toggleAccordionItem('summary')}>
            Summary
          </Accordion.Control>
          <Accordion.Panel>
            <Summary data={trip} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
}
