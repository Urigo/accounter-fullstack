import { useEffect, useState, type ReactElement } from 'react';
import { Combine } from 'lucide-react';
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
        <Combine className="size-5" />
      </Button>
    </Tooltip>
  );
}
