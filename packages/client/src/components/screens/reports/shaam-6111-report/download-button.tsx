import { useCallback, useState, type ReactElement } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useClient } from 'urql';
import { Shaam6111FileDocument } from '../../../../gql/graphql.js';
import { base64ToBytes, downloadFile } from '../../../../helpers/files.js';
import { SUPPRESS_ERROR_TOAST_CONTEXT } from '../../../../providers/urql-error-handler.js';
import { Button } from '../../../ui/button.js';
import { Spinner } from '../../../ui/spinner.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query Shaam6111File($year: Int!, $businessId: UUID) {
    shaam6111(year: $year, businessId: $businessId) {
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
  businessId: string;
  /** Whether the report passed validation; an invalid report has no file to download. */
  disabled?: boolean;
};

/** Downloads the 6111 file for upload to SHAAM (Windows-1255, as the server encoded it). */
export function Shaam6111DownloadButton({ year, businessId, disabled }: Props): ReactElement {
  const client = useClient();
  const [fetching, setFetching] = useState(false);

  const download = useCallback(async () => {
    setFetching(true);
    try {
      const { data, error } = await client
        .query(
          Shaam6111FileDocument,
          { year, businessId },
          // This button reports its own failure: skip the client-wide error toast so a failed
          // download (e.g. books changed since the panel loaded) shows one toast, not two. The
          // file reflects the current books, so it is never served from a cache.
          { ...SUPPRESS_ERROR_TOAST_CONTEXT, requestPolicy: 'network-only' },
        )
        .toPromise();
      // `file` is null (with an error) while the report has blocking validation issues
      const file = data?.shaam6111.file;
      if (error || !file) {
        toast.error('Error', {
          // the GraphQL message, without urql's "[GraphQL] " / "[Network] " prefix
          description:
            error?.graphQLErrors[0]?.message ??
            error?.networkError?.message ??
            'Failed to generate the 6111 file',
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
  }, [client, year, businessId]);

  // The title sits on a wrapper: a disabled button has `pointer-events: none` and never shows it
  return (
    <span title={disabled ? 'Resolve the blocking issues to download the file' : undefined}>
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={download}
        disabled={disabled || fetching}
      >
        {fetching ? <Spinner /> : <Download className="h-4 w-4" />}
        הורד קובץ
      </Button>
    </span>
  );
}
