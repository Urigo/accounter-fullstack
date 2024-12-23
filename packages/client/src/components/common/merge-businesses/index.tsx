import { ReactElement, useCallback, useEffect, useState } from 'react';
import { ArrowsJoin2 } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MergeBusinessesSelectionForm } from './merge-businesses-selection-form.js';

export function MergeBusinessesButton(props: {
  selected: { id: string; onChange: () => void }[];
  resetMerge: () => void;
}): ReactElement {
  const [opened, { close, open }] = useDisclosure(false);
  const { selected, resetMerge } = props;
  const distinctIDs = new Set(selected.map(({ id }) => id));
  const isMergable = distinctIDs.size >= 1;

  const [variant, setVariant] = useState<ActionIconProps['variant']>(
    isMergable ? 'filled' : 'default',
  );
  const [color, setColor] = useState<'blue' | 'gray'>(isMergable ? 'blue' : 'gray');

  useEffect(() => {
    setVariant(isMergable ? 'filled' : 'default');
    setColor(isMergable ? 'blue' : 'gray');
  }, [isMergable]);

  const onDone = useCallback(() => {
    close();
    selected.map(({ onChange }) => onChange());
  }, [selected, close]);

  return (
    <>
      <ActionIcon
        onClick={(): void => {
          if (isMergable) open();
        }}
        disabled={!isMergable}
        variant={variant}
        color={color}
        className={isMergable ? 'bg-blue-500' : undefined}
        size={30}
      >
        <ArrowsJoin2 size={20} color={color} />
      </ActionIcon>
      <Modal opened={opened} onClose={close} size="auto" centered>
        <MergeBusinessesSelectionForm
          businessIds={Array.from(distinctIDs)}
          onDone={onDone}
          resetMerge={resetMerge}
        />
      </Modal>
    </>
  );
}
