import type { ReactElement } from 'react';
import { Copy, Link } from 'lucide-react';
import { writeToClipboard } from '../../../helpers/index.js';
import { Button } from '../../ui/button.js';

interface Props {
  content: string;
  isLink?: boolean;
}

export const CopyToClipboardButton = ({ content, isLink }: Props): ReactElement => {
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-7.5"
      onClick={(): void => writeToClipboard(content)}
    >
      {isLink ? <Link className="size-5" /> : <Copy className="size-5" />}
    </Button>
  );
};
