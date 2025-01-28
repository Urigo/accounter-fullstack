import type { ReactElement } from 'react';
import { FileDown } from 'lucide-react';
import { Tooltip } from '@mantine/core';

interface Props {
  data: string;
  fileName: string;
}

function csvDownload(data: string, fileName: string): void {
  const csvData = new Blob([data], { type: 'text/csv;charset=utf-8' });
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
      <button onClick={() => csvDownload(data, fileName)}>
        <FileDown />
      </button>
    </Tooltip>
  );
};
