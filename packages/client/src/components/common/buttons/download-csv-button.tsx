import type { ReactElement } from 'react';
import { FileDown } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { Button } from '../../ui/button';

interface Props {
  data: string;
  fileName: string;
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

export const DownloadCSVButton = ({ data, fileName }: Props): ReactElement => {
  return (
    <Tooltip label="Download CSV" position="top">
      <Button variant="outline" onClick={() => csvDownload(data, fileName)} className="p-2">
        <FileDown size={20} />
      </Button>
    </Tooltip>
  );
};
