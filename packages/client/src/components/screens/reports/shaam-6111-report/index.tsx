'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
import {
  Shaam6111ReportScreenDocument,
  type Shaam6111ReportScreenQuery,
} from '../../../../gql/graphql.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { Card, CardContent, CardHeader } from '../../../ui/card.js';
import { Shaam6111Filters } from './shaam-6111-filters.js';
import { Shaam6111ReportContent } from './shaam-6111-report-content.js';
import { getShaam6111AvailableYears } from './years.js';

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

/** A `?year=` / `?referenceYear=` value, when it is a plausible tax year. */
function parseYearParam(value: string | null): string | undefined {
  return value && /^(19|20)\d{2}$/.test(value) ? value : undefined;
}

export function Shaam6111Report() {
  const { setFiltersContext } = useContext(FiltersContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBusiness, setSelectedBusiness] = useState<string | undefined>(undefined);

  // The year lives in the URL, so the annual workflow can link straight to the year it closes.
  // Without one, default to the latest closed year.
  const selectedYear = parseYearParam(searchParams.get('year')) ?? getShaam6111AvailableYears()[0];
  const referenceYear = parseYearParam(searchParams.get('referenceYear'));

  const updateSearchParam = useCallback(
    (key: 'year' | 'referenceYear', value?: string) => {
      setSearchParams(
        previous => {
          const next = new URLSearchParams(previous);
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const setSelectedYear = useCallback(
    (year: string) => updateSearchParam('year', year),
    [updateSearchParam],
  );
  const setReferenceYear = useCallback(
    (year?: string) => updateSearchParam('referenceYear', year),
    [updateSearchParam],
  );

  const [{ data, fetching, error }] = useQuery({
    query: Shaam6111ReportScreenDocument,
    variables: {
      year: selectedYear ? Number.parseInt(selectedYear, 10) : 0,
      businessId: selectedBusiness,
    },
    pause: !selectedYear || !selectedBusiness,
  });

  const showReference = !!referenceYear && referenceYear !== selectedYear;
  const [{ data: referenceData }] = useQuery({
    query: Shaam6111ReportScreenDocument,
    variables: {
      year: showReference ? Number.parseInt(referenceYear, 10) : 0,
      businessId: selectedBusiness,
    },
    pause: !showReference || !selectedBusiness,
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
  }, [
    setFiltersContext,
    selectedBusiness,
    selectedYear,
    referenceYear,
    setSelectedYear,
    setReferenceYear,
  ]);

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
            errorMessage={error?.message}
            data={data}
            referenceData={showReference ? referenceData : undefined}
            selectedBusiness={selectedBusiness}
            selectedYear={selectedYear}
            referenceYear={showReference ? referenceYear : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Content({
  fetching,
  errorMessage,
  data,
  referenceData,
  selectedBusiness,
  selectedYear,
  referenceYear,
}: {
  fetching: boolean;
  errorMessage?: string;
  data?: Shaam6111ReportScreenQuery;
  referenceData?: Shaam6111ReportScreenQuery;
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
        {errorMessage && <p className="text-sm text-red-600 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <Shaam6111ReportContent
      data={reportData}
      referenceData={referenceData?.shaam6111.data}
      businessInfo={data.shaam6111.business}
      selectedBusiness={selectedBusiness}
      selectedYear={selectedYear}
      referenceYear={referenceYear}
    />
  );
}
