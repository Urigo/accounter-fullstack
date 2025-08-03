import type { ComponentProps, ReactElement } from 'react';
import { CircleX } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { useCloseDocument } from '../../../hooks/use-close-document.js';
import { Button } from '../../ui/button.js';

export function CloseDocumentButton(
  props: ComponentProps<typeof Button> & {
    documentId: string;
  },
): ReactElement {
  const { closeDocument } = useCloseDocument();
  return (
    <Tooltip label="Close Document">
      <Button
        className="size-7.5 text-red-600"
        variant="ghost"
        {...props}
        onClick={() => closeDocument({ documentId: props.documentId })}
      >
        <CircleX className="size-5" />
      </Button>
    </Tooltip>
  );
}
