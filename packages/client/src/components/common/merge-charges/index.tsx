import { ReactElement, useCallback, useEffect, useState } from 'react';
import { ArrowsJoin2 } from 'tabler-icons-react';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.js';
import { MergeChargesSelectionForm } from './merge-charges-selection-form.js';

export function MergeChargesButton(props: {
  selected: { id: string; onChange: () => void }[];
  resetMerge: () => void;
}): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);
  const { selected, resetMerge } = props;
  const distinctIDs = new Set(selected.map(({ id }) => id));
  const isMergeable = distinctIDs.size >= 1;

  const [variant, setVariant] = useState<'outline' | 'default'>(
    isMergeable ? 'default' : 'outline',
  );

  useEffect(() => {
    setVariant(isMergeable ? 'default' : 'outline');
  }, [isMergeable]);

  const onDone = useCallback(() => {
    close();
    selected.map(({ onChange }) => onChange());
  }, [selected, close]);

  return (
    <>
      <Button
        onClick={(): void => {
          if (isMergeable) open();
        }}
        disabled={!isMergeable}
        variant={variant}
        className={cn('size-7.5', isMergeable ? ' bg-blue-500 hover:bg-blue-500/90' : '')}
        size="icon"
      >
        <ArrowsJoin2 className="size-5" />
      </Button>
      <Modal opened={opened} onClose={close} size="auto" centered>
        <MergeChargesSelectionForm
          chargeIds={Array.from(distinctIDs)}
          onDone={onDone}
          resetMerge={resetMerge}
        />
      </Modal>
    </>
  );
}
