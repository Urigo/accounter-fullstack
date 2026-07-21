import { useCallback, useState, type ReactElement } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Button } from '../../ui/button.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip.js';

interface Props {
  createFileVariables: () => Promise<{ fileContent: string; fileName: string }>;
  buttonProps?: Omit<React.ComponentProps<typeof Button>, 'onClick'>;
  buttonContent?: ReactElement;
  label?: string;
}

function csvDownload(data: string, fileName: string): void {
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
  const csvData = new Blob([BOM, data], { type: 'text/csv;charset=UTF-8' });
  const csvURL = URL.createObjectURL(csvData);
  const link = document.createElement('a');
  link.href = csvURL;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const DownloadCSVButton = ({
  createFileVariables,
  buttonProps,
  buttonContent,
  label,
}: Props): ReactElement => {
  const [loading, setLoading] = useState(false);

  // Preparing the file (e.g. fetching export data) can take a moment. Track a loading state so we
  // can surface progress and guard against re-clicks while a download is being prepared.
  const onClick = useCallback(async () => {
    setLoading(true);
    try {
      const { fileContent, fileName } = await createFileVariables();
      csvDownload(fileContent, fileName);
    } catch (error) {
      // `createFileVariables` is responsible for surfacing user-facing errors (e.g. a toast); catch
      // here so a rejection just aborts the download instead of becoming an unhandled rejection.
      console.error('Failed to prepare CSV download', error);
    } finally {
      setLoading(false);
    }
  }, [createFileVariables]);

  const {
    className: buttonClassName,
    disabled: buttonDisabled,
    ...restButtonProps
  } = buttonProps ?? {};

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          variant="outline"
          className={cn('relative p-2', buttonClassName)}
          disabled={loading || buttonDisabled}
          aria-busy={loading}
          {...restButtonProps}
          onClick={onClick}
        >
          {/* Keep the original content in place (just hidden) so the button size stays stable, and
              overlay a centered spinner while preparing the file. */}
          <span className={loading ? 'invisible' : 'contents'}>
            {buttonContent || <FileDown size={20} />}
          </span>
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{loading ? 'Preparing download…' : label || 'Download CSV'}</p>
      </TooltipContent>
    </Tooltip>
  );
};
