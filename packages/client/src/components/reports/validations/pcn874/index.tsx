import { ReactElement, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import {
  ValidatePcn874ReportsDocument,
  ValidatePcn874ReportsQueryVariables,
} from '../../../../gql/graphql.js';
import { Pcn874ReportPatch } from './rerport-patch.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ValidatePcn874Reports(
    $businessId: UUID
    $fromMonthDate: TimelessDate!
    $toMonthDate: TimelessDate!
  ) {
    pcnByDate(businessId: $businessId, fromMonthDate: $fromMonthDate, toMonthDate: $toMonthDate)
      @stream {
      id
      business {
        id
        name
      }
      date
      content
      diffContent
    }
  }
`;

type Props = {
  filter: ValidatePcn874ReportsQueryVariables;
};

export const Pcn874Validator = ({ filter }: Props): ReactElement => {
  // fetch data
  const [{ data, fetching, hasNext }] = useQuery({
    query: ValidatePcn874ReportsDocument,
    variables: filter,
  });

  const reports = useMemo(() => {
    if (!data?.pcnByDate) {
      return [];
    }
    return data.pcnByDate.sort((a, b) => {
      if (b.date > a.date) return 1;
      if (b.date < a.date) return -1;
      return 0;
    });
  }, [data?.pcnByDate]);

  if (fetching) {
    return (
      <div className="w-full h-full flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!!data && hasNext && (
        <div className="w-full h-full flex justify-center">
          <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
        </div>
      )}
      {reports.map((report, index) => (
        <Pcn874ReportPatch
          content={report.content}
          contentOrigin={report.diffContent}
          monthDate={report.date}
          key={index}
        />
      ))}
    </div>
  );
};
