'use client';

import { useContext, useEffect, useState } from 'react';
import { useQuery } from 'urql';
import {
  Shaam6111ReportScreenDocument,
  type Shaam6111ReportScreenQuery,
} from '../../../../gql/graphql.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { Card, CardContent, CardHeader } from '../../../ui/card.js';
import { Shaam6111Filters } from './shaam6111-filters.js';
import { Shaam6111ReportContent } from './shaam6111-report-content.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Shaam6111ReportScreen($year: Int!, $businessId: UUID) {
    shaam6111(year: $year, businessId: $businessId) {
      id
      year
      data {
        id
        ...Shaam6111DataContent
      }
      business {
        id
        ...Shaam6111DataContentHeaderBusiness
      }
    }
  }
`;

export function Shaam6111Report() {
  const { setFiltersContext } = useContext(FiltersContext);
  const [selectedBusiness, setSelectedBusiness] = useState<string | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<string | undefined>(undefined);
  const [referenceYear, setReferenceYear] = useState<string | undefined>(undefined);

  const [{ data, fetching }] = useQuery({
    query: Shaam6111ReportScreenDocument,
    variables: {
      year: selectedYear ? Number.parseInt(selectedYear, 10) : 0,
      businessId: selectedBusiness,
    },
    pause: !selectedYear || !selectedBusiness,
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5" dir="rtl">
        <Shaam6111Filters
          selectedBusiness={selectedBusiness}
          setSelectedBusiness={setSelectedBusiness}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          referenceYear={referenceYear}
          setReferenceYear={setReferenceYear}
        />
      </div>,
    );
  }, [setFiltersContext, selectedBusiness, selectedYear, referenceYear]);

  return (
    <div className="container mx-auto" dir="rtl">
      <Card className="border-2 border-gray-300">
        <CardHeader className="bg-gray-100 border-b-2 border-gray-300 flex flex-row justify-between items-center">
          <div className="text-center w-full">
            <h1 className="text-2xl font-bold">נספח לטופס הדו"ח השנתי ליחיד ולחבר בני אדם</h1>
            <h2 className="text-xl">לשנת המס {selectedYear}</h2>
            <p className="text-sm">נתוני הדוחות הכספיים, מאזן, רווח והפסד ודו"ח ההתאמה למס</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Content
            fetching={fetching}
            data={data}
            selectedBusiness={selectedBusiness}
            selectedYear={selectedYear}
            referenceYear={referenceYear}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Content({
  fetching,
  data,
  selectedBusiness,
  selectedYear,
  referenceYear,
}: {
  fetching: boolean;
  data?: Shaam6111ReportScreenQuery;
  selectedBusiness?: string;
  selectedYear?: string;
  referenceYear?: string;
}) {
  if (fetching) {
    return (
      <div className="container mx-auto p-8 text-center" dir="rtl">
        <p className="text-lg text-gray-600">טוען נתונים...</p>
      </div>
    );
  }

  if (!selectedYear || !selectedBusiness) {
    return (
      <div className="container mx-auto p-8 text-center" dir="rtl">
        <p className="text-lg text-gray-600">יש לבחור עסק ושנת דיווח</p>
      </div>
    );
  }

  const reportData = data?.shaam6111.data;

  if (!reportData) {
    return (
      <div className="container mx-auto p-8 text-center" dir="rtl">
        <p className="text-lg text-gray-600">אין נתונים זמינים עבור העסק והשנה שנבחרו</p>
      </div>
    );
  }

  return (
    <Shaam6111ReportContent
      data={reportData}
      businessInfo={data.shaam6111.business}
      selectedBusiness={selectedBusiness}
      selectedYear={selectedYear}
      referenceYear={referenceYear}
    />
  );
}
