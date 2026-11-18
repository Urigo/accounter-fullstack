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
      validation {
        ...Shaam6111ValidationIssues
      }
      taxAdjustmentOverrides {
        code
        amount
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
    (year: string) =>
      setSearchParams(
        previous => {
          const next = new URLSearchParams(previous);
          next.set('year', year);
          // a year is not compared with itself: drop a comparison year equal to the new year, so
          // it doesn't silently come back when the report year changes again
          if (next.get('referenceYear') === year) {
            next.delete('referenceYear');
          }
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const setReferenceYear = useCallback(
    (year?: string) => updateSearchParam('referenceYear', year),
    [updateSearchParam],
  );

  const [{ data, fetching, error }, refetch] = useQuery({
    query: Shaam6111ReportScreenDocument,
    variables: {
      year: selectedYear ? Number.parseInt(selectedYear, 10) : 0,
      businessId: selectedBusiness,
    },
    pause: !selectedYear || !selectedBusiness,
  });

  const showReference = !!referenceYear && referenceYear !== selectedYear;
  const [{ data: referenceData, fetching: referenceFetching, error: referenceError }] = useQuery({
    query: Shaam6111ReportScreenDocument,
    variables: {
      year: showReference ? Number.parseInt(referenceYear, 10) : 0,
      businessId: selectedBusiness,
    },
    pause: !showReference || !selectedBusiness,
  });

  // Compare only once the comparison year has loaded: while it loads, or if it fails, the tabs
  // would show the "changes vs year" badge with no change values, which reads as "no change"
  const loadedReference =
    showReference && !referenceFetching ? referenceData?.shaam6111.data : undefined;

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
            referenceErrorMessage={
              showReference && referenceError
                ? `שנת ההשוואה ${referenceYear}: ${referenceError.message}`
                : undefined
            }
            data={data}
            referenceData={loadedReference ? referenceData : undefined}
            selectedBusiness={selectedBusiness}
            selectedYear={selectedYear}
            referenceYear={loadedReference ? referenceYear : undefined}
            onSettingsSaved={() => refetch({ requestPolicy: 'network-only' })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Content({
  fetching,
  errorMessage,
  referenceErrorMessage,
  data,
  referenceData,
  selectedBusiness,
  selectedYear,
  referenceYear,
  onSettingsSaved,
}: {
  fetching: boolean;
  errorMessage?: string;
  referenceErrorMessage?: string;
  data?: Shaam6111ReportScreenQuery;
  referenceData?: Shaam6111ReportScreenQuery;
  selectedBusiness?: string;
  selectedYear?: string;
  referenceYear?: string;
  onSettingsSaved?: () => void;
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
    <>
      {referenceErrorMessage && (
        <p className="text-sm text-red-600 px-4 pt-4">{referenceErrorMessage}</p>
      )}
      <Shaam6111ReportContent
        data={reportData}
        referenceData={referenceData?.shaam6111.data}
        businessInfo={data.shaam6111.business}
        validation={data.shaam6111.validation}
        selectedBusiness={selectedBusiness}
        selectedYear={selectedYear}
        referenceYear={referenceYear}
        taxAdjustmentOverrides={data.shaam6111.taxAdjustmentOverrides}
        onSettingsSaved={onSettingsSaved}
      />
    </>
  );
}
