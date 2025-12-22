import { useEffect, type ReactElement } from 'react';
import { FileDigit } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { GeneratePcnDocument, type VatReportFilter } from '../../../gql/graphql.js';
import { dedupeFragments, downloadFile } from '../../../helpers/index.js';
import { Tooltip } from '../../common/index.js';
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
      const blob = new File([data.pcnFile.reportContent], 'pcn874.txt', { type: 'text/plain' });
      downloadFile(blob);
    }
  }, [data]);

  return (
    <Tooltip content="Generate and Download PCN874 File">
      <Button
        disabled={fetching || isLoading}
        variant="outline"
        size="icon"
        className="size-7.5"
        onClick={executeQuery}
      >
        <FileDigit className="size-5" />
      </Button>
    </Tooltip>
  );
};
