import { ReactElement, useContext, useEffect, useState } from 'react';
import { format, subYears } from 'date-fns';
import { ValidatePcn874ReportsQueryVariables } from '../../../gql/graphql.js';
import { TimelessDateString } from '../../../helpers/index.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion.js';
import { Pcn874Validator } from './pcn874/index.js';
import { ValidateReportsFilter } from './validate-reports-filter.js';

export const ValidateReportsScreen = (): ReactElement => {
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);
  const [filter, setFilter] = useState<ValidatePcn874ReportsQueryVariables>(
    get('validateReportsFilters')
      ? (JSON.parse(
          decodeURIComponent(get('validateReportsFilters') as string),
        ) as ValidatePcn874ReportsQueryVariables)
      : {
          fromMonthDate: format(subYears(new Date(), 1), 'yyyy-MM-15') as TimelessDateString,
          toMonthDate: format(new Date(), 'yyyy-MM-15') as TimelessDateString,
        },
  );

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <ValidateReportsFilter filter={{ ...filter }} setFilter={setFilter} />
      </div>,
    );
  }, [filter, setFiltersContext]);

  return (
    <PageLayout title="VAT Monthly Report">
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Monthly VAT (PCN874)</AccordionTrigger>
          <AccordionContent>
            <Pcn874Validator filter={filter} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </PageLayout>
  );
};
