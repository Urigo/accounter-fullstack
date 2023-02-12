import { useEffect } from 'react';
import { ActionIcon } from '@mantine/core';
import { Report } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { GeneratePcnDocument, VatReportFilter } from '../../../gql/graphql';
import { dedupeFragments } from '../../../helpers';

/* GraphQL */ `
  query GeneratePCN($fromDate: TimelessDate!, $toDate: TimelessDate!, $financialEntityId: ID!) {
    pcnFile(
        fromDate: $fromDate,
        toDate: $toDate,
        financialEntityId: $financialEntityId
    ) {
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
  filter: { fromDate, toDate, financialEntityId },
  isLoading,
}: Props) => {
  const [{ data, fetching }, executeQuery] = useQuery({
    query: dedupeFragments(GeneratePcnDocument),
    pause: true,
    variables: {
      fromDate,
      toDate,
      financialEntityId,
    },
  });

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
    <ActionIcon disabled={fetching || isLoading} variant="default" onClick={executeQuery} size={30}>
      <Report size={20} />
    </ActionIcon>
  );
};
