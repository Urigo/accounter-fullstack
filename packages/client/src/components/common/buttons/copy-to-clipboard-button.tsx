import { ReactElement } from 'react';
import { Copy, Link } from 'tabler-icons-react';
import { writeToClipboard } from '../../../helpers/index.js';
import { ActionIcon } from '../../ui/action-icon.js';

interface Props {
  content: string;
  isLink?: boolean;
}

export const CopyToClipboardButton = ({ content, isLink }: Props): ReactElement => {
  return (
    <ActionIcon variant="outline" onClick={(): void => writeToClipboard(content)} size={30}>
      {isLink ? <Link size={20} /> : <Copy size={20} />}
    </ActionIcon>
  );
};
