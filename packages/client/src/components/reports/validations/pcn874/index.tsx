import { ReactElement } from 'react';
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
    pcnByDate(businessId: $businessId, fromMonthDate: $fromMonthDate, toMonthDate: $toMonthDate) {
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
  const [{ data, fetching }] = useQuery({
    query: ValidatePcn874ReportsDocument,
    variables: filter,
  });

  if (fetching) {
    return (
      <div className="w-full h-full flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data?.pcnByDate?.map((report, index) => (
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
