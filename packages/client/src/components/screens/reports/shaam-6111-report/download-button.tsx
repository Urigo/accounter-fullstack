import { useCallback, useState, type ReactElement } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useClient } from 'urql';
import { Shaam6111FileDocument } from '../../../../gql/graphql.js';
import { downloadFile } from '../../../../helpers/files.js';
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

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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
          // the file reflects the current books: never serve it from cache
          { requestPolicy: 'network-only' },
        )
        .toPromise();
      const file = data?.shaam6111.file;
      if (error || !file) {
        toast.error('Error', {
          description: error?.message ?? 'Failed to generate the 6111 file',
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

  return (
    <Button
      variant="outline"
      className="flex items-center gap-2"
      onClick={download}
      disabled={disabled || fetching}
      title={disabled ? 'Resolve the blocking issues to download the file' : undefined}
    >
      {fetching ? <Spinner /> : <Download className="h-4 w-4" />}
      הורד קובץ
    </Button>
  );
}
