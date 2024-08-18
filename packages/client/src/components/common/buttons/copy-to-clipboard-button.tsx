import { ReactElement } from 'react';
import { Copy, Link } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { writeToClipboard } from '../../../helpers/index.js';

interface Props {
  content: string;
  isLink?: boolean;
}

export const CopyToClipboardButton = ({ content, isLink }: Props): ReactElement => {
  return (
    <ActionIcon variant="default" onClick={(): void => writeToClipboard(content)} size={30}>
      {isLink ? <Link size={20} /> : <Copy size={20} />}
    </ActionIcon>
  );
};
