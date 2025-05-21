import { ReactElement, useEffect, useState } from 'react';
import { ArrowsJoin2 } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.js';

export function ToggleMergeSelected(props: {
  toggleMergeSelected: () => void;
  mergeSelected: boolean;
}): ReactElement {
  const { mergeSelected, toggleMergeSelected } = props;
  const [variant, setVariant] = useState<'ghost' | 'default'>(mergeSelected ? 'default' : 'ghost');

  useEffect(() => {
    setVariant(mergeSelected ? 'default' : 'ghost');
  }, [mergeSelected]);

  return (
    <Tooltip label="Select for merge">
      <Button
        onClick={event => {
          event.stopPropagation();
          toggleMergeSelected();
        }}
        variant={variant}
        className={cn('size-7.5', mergeSelected ? 'bg-blue-500 hover:bg-blue-500/90' : '')}
      >
        <ArrowsJoin2 className="size-5" />
      </Button>
    </Tooltip>
  );
}
