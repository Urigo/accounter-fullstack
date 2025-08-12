import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { format, subYears } from 'date-fns';
import type { ValidatePcn874ReportsQueryVariables } from '../../../gql/graphql.js';
import type { TimelessDateString } from '../../../helpers/index.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { FiltersContext } from '../../../providers/filters-context.js';
import { PageLayout } from '../../layout/page-layout.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion.js';
import { Card, CardContent, CardTitle } from '../../ui/card.js';
import { Pcn874Validator } from './pcn874/index.js';
import { ValidateReportsFilter } from './validate-reports-filter.js';

export const ValidateReportsScreen = (): ReactElement => {
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);

  const initialFilter = useMemo(() => {
    try {
      if (get('validateReportsFilters')) {
        return JSON.parse(decodeURIComponent(get('validateReportsFilters') as string));
      }
    } catch (e) {
      console.error('Error parsing filter from URL', e);
    }
    return {
      fromMonthDate: format(subYears(new Date(), 1), 'yyyy-MM-15') as TimelessDateString,
      toMonthDate: format(new Date(), 'yyyy-MM-15') as TimelessDateString,
    };
  }, [get]);
  const [filter, setFilter] = useState<ValidatePcn874ReportsQueryVariables>(initialFilter);

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <ValidateReportsFilter filter={{ ...filter }} setFilter={setFilter} />
      </div>,
    );
  }, [filter, setFiltersContext]);

  return (
    <PageLayout title="Report Validations">
      <Accordion type="single" collapsible>
        <AccordionItem value="pcn874">
          <Card className="p-4">
            <AccordionTrigger>
              <CardTitle>Monthly VAT (PCN874)</CardTitle>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Pcn874Validator filter={filter} />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </PageLayout>
  );
};
