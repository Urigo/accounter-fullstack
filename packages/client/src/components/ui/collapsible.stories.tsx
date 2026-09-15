import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible.js';

/**
 * Replaced Mantine's `Collapse`. The height animation is not built into the component: it
 * comes from the `animate-collapsible-down` / `animate-collapsible-up` utilities in
 * `index.css`, which drive Radix's `--radix-collapsible-content-height` over 500ms linear —
 * the duration and easing the Mantine call site used.
 */
const ANIMATION =
  'overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down';

function Harness({ animated = true }: { animated?: boolean }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-80 p-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline">{open ? 'Hide' : 'Show'} documents</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className={animated ? ANIMATION : undefined}>
          <div className="mt-2 space-y-2 rounded-md border p-3 text-sm">
            <div>invoice-2026-08.pdf</div>
            <div>receipt-4821.jpg</div>
            <div>credit-note-119.pdf</div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const meta = {
  title: 'UI/Collapsible',
  component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** With the height animation, as the charge document gallery uses it. */
export const Animated: Story = { args: {} };

/** Without it, which is Radix's own default — the content just appears. */
export const Unanimated: Story = { args: { animated: false } };
