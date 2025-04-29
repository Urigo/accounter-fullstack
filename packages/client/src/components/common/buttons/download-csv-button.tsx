import { useCallback, type ReactElement } from 'react';
import { FileDown } from 'lucide-react';
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
  const onClick = useCallback(() => {
    createFileVariables().then(({ fileContent, fileName }) => {
      csvDownload(fileContent, fileName);
    });
  }, [createFileVariables]);

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button variant="outline" className="p-2" {...buttonProps} onClick={onClick}>
          {buttonContent || <FileDown size={20} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label || 'Download CSV'}</p>
      </TooltipContent>
    </Tooltip>
  );
};
