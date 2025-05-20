import { ReactElement, useEffect } from 'react';
import { toast } from 'sonner';
import { Report } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { GeneratePcnDocument, VatReportFilter } from '../../../gql/graphql.js';
import { dedupeFragments } from '../../../helpers/index.js';
import { Button } from '../../ui/button.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query GeneratePCN($monthDate: TimelessDate!, $financialEntityId: UUID!) {
    pcnFile(monthDate: $monthDate, financialEntityId: $financialEntityId) {
      reportContent
      fileName
    }
  }
`;

type Props = {
  filter: VatReportFilter;
  isLoading: boolean;
};

export const PCNGenerator = ({
  filter: { monthDate, financialEntityId },
  isLoading,
}: Props): ReactElement => {
  const [{ data, fetching, error }, executeQuery] = useQuery({
    query: dedupeFragments(GeneratePcnDocument),
    pause: true,
    variables: {
      monthDate,
      financialEntityId,
    },
  });

  useEffect(() => {
    if (error) {
      const message = 'Error generating PCN874 file';
      console.error(`${message}: ${error}`);
      toast.error('Error', {
        description: message,
        duration: 5000,
        closeButton: true,
      });
    }
  }, [error]);

  useEffect(() => {
    if (data) {
      const blob = new Blob([data.pcnFile.reportContent], { type: 'text/plain' });
      const fileURL = window.URL.createObjectURL(blob);
      // Setting various property values
      const alink = document.createElement('a');
      alink.href = fileURL;
      alink.download = data.pcnFile.fileName;
      alink.click();
    }
  }, [data]);

  return (
    <Tooltip label="Generate and Download PCN874 File">
      <Button
        disabled={fetching || isLoading}
        variant="outline"
        size="icon"
        className="size-7.5"
        onClick={executeQuery}
      >
        <Report className="size-5" />
      </Button>
    </Tooltip>
  );
};
