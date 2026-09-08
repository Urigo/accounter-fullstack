import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../ui/button.js';
import { PopUpModal } from './modal.js';

/**
 * The filter dialog behind all twelve `*-filters.tsx` screens. These stories exist mainly to
 * check dismissal: `withCloseButton` defaults to false, so most call sites rely on Escape and
 * outside-click as the only way out — the behaviour most at risk in the Mantine → Radix swap.
 */
function Harness({
  withCloseButton = false,
  modalSize,
  title,
}: {
  withCloseButton?: boolean;
  modalSize?: string;
  title?: string;
}): ReactElement {
  const [opened, setOpened] = useState(true);
  return (
    <div className="p-6">
      <Button onClick={() => setOpened(true)}>Open filters</Button>
      <PopUpModal
        opened={opened}
        onClose={() => setOpened(false)}
        withCloseButton={withCloseButton}
        modalSize={modalSize}
        title={title}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Escape and clicking outside should both close this.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => setOpened(false)}>Apply</Button>
            <Button variant="outline" onClick={() => setOpened(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </PopUpModal>
    </div>
  );
}

const meta = {
  title: 'Modals/PopUpModal',
  component: Harness,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The common case: no close button, dismissed by Escape or outside-click only. */
export const Default: Story = { args: {} };

export const WithCloseButton: Story = { args: { withCloseButton: true } };

/** `modalSize="xl"` — the wide filter dialogs (salaries, balance report, documents). */
export const Wide: Story = { args: { modalSize: 'xl', withCloseButton: true } };

export const WithTitle: Story = { args: { title: 'Depreciation', withCloseButton: true } };
