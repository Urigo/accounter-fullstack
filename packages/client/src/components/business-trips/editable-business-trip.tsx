import { ReactElement, useCallback, useState } from 'react';
import { Plus } from 'tabler-icons-react';
import { Accordion } from '@mantine/core';
import {
  EditableBusinessTripFragmentDoc,
  type EditableBusinessTripFragment,
} from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { Attendees } from '../common/business-trip-report/parts/attendees.js';
import { Flights } from '../common/business-trip-report/parts/flights.js';
import { ReportHeader } from '../common/business-trip-report/parts/report-header.js';
import { UncategorizedTransactions } from '../common/business-trip-report/parts/uncategorized-transactions.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment EditableBusinessTrip on BusinessTrip {
    id
    ...BusinessTripReportHeaderFields
    ...BusinessTripReportAttendeesFields
    ...BusinessTripUncategorizedTransactionsFields
    ...BusinessTripReportFlightsFields
    # ...BusinessTripReportSummaryFields
  }
`;

interface Props {
  data: FragmentType<typeof EditableBusinessTripFragmentDoc>;
  isExtended?: boolean;
}

export function EditableBusinessTrip({ data, isExtended = false }: Props): ReactElement {
  const [trip, setTrip] = useState<EditableBusinessTripFragment>(
    getFragmentData(EditableBusinessTripFragmentDoc, data),
  );
  const [accordionItems, setAccordionItems] = useState<string[]>([]);

  function toggleAccordionItem(item: string): void {
    if (accordionItems.includes(item)) {
      setAccordionItems(current => current.filter(currItem => currItem !== item));
    } else {
      setAccordionItems(current => [...current, item]);
    }
  }

  const onChangeDo = useCallback(() => {
    // setTrip();
  }, [setTrip]);

  return (
    <div className="flex flex-col gap-5 mt-5">
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
            <Accordion.Control onClick={() => toggleAccordionItem('uncategorized-transactions')}>
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

        {/* accommodations */}
        {/* t&s */}
        {/* other */}

        <Accordion.Item value="summary">
          <Accordion.Control onClick={() => toggleAccordionItem('summary')}>
            Summary
          </Accordion.Control>
          <Accordion.Panel>{/* <Summary data={trip} /> */}</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
