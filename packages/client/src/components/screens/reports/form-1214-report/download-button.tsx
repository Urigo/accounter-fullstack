import { useCallback, useId, useState, type ReactElement } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useClient } from 'urql';
import { Form1214FileDocument } from '../../../../gql/graphql.js';
import { base64ToBytes, downloadFile } from '../../../../helpers/files.js';
import { SUPPRESS_ERROR_TOAST_CONTEXT } from '../../../../providers/urql-error-handler.js';
import { Button } from '../../../ui/button.js';
import { Spinner } from '../../../ui/spinner.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Form1214File($year: Int!) {
    report1214(year: $year) {
      id
      file {
        id
        fileName
        encodedContent
      }
    }
  }
`;

type Props = {
  year: number;
  /**
   * Why the file cannot be downloaded now (e.g. the report has blocking validation errors); the
   * button is enabled when there is none.
   */
  disabledReason?: string;
};

/** Downloads the form 1214 file for upload to SHAAM (Windows-1255, as the server encoded it). */
export function Form1214DownloadButton({ year, disabledReason }: Props): ReactElement {
  const client = useClient();
  const [fetching, setFetching] = useState(false);

  const download = useCallback(async () => {
    setFetching(true);
    try {
      const { data, error } = await client
        .query(
          Form1214FileDocument,
          { year },
          // This button reports its own failure: skip the client-wide error toast so a failed
          // download (e.g. data changed since the panel loaded) shows one toast, not two. The
          // file reflects the current data, so it is never served from a cache.
          { ...SUPPRESS_ERROR_TOAST_CONTEXT, requestPolicy: 'network-only' },
        )
        .toPromise();
      // `file` is null (with a REPORT_1214_VALIDATION_FAILED error) while the report has errors
      const file = data?.report1214.file;
      if (error || !file) {
        toast.error('Error', {
          // the GraphQL message, without urql's "[GraphQL] " / "[Network] " prefix
          description:
            error?.graphQLErrors[0]?.message ??
            error?.networkError?.message ??
            'Failed to generate the 1214 file',
        });
        return;
      }
      downloadFile(
        new File([base64ToBytes(file.encodedContent)], file.fileName, {
          type: 'application/octet-stream',
        }),
      );
    } finally {
      setFetching(false);
    }
  }, [client, year]);

  const reasonId = useId();
  return (
    <span className="flex items-center gap-2">
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={download}
        disabled={!!disabledReason || fetching}
        aria-describedby={disabledReason ? reasonId : undefined}
      >
        {fetching ? <Spinner /> : <Download className="h-4 w-4" />}
        Download file
      </Button>
      {disabledReason && (
        <span id={reasonId} className="text-xs text-muted-foreground">
          {disabledReason}
        </span>
      )}
    </span>
  );
}
