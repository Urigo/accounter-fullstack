import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button.js';
import { LoadingOverlay, Overlay } from './overlay.js';

const Panel = ({ children }: { children?: React.ReactNode }) => (
  <div className="relative h-48 w-80 rounded-lg border bg-white p-4">
    <p className="text-sm font-medium">Trip expense</p>
    <p className="mt-2 text-xs text-gray-500">
      Amsterdam, 14–17 March. Three receipts pending categorisation.
    </p>
    <Button className="mt-4" size="sm">
      Categorise
    </Button>
    {children}
  </div>
);

const meta = {
  title: 'UI/Overlay',
  component: Overlay,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Overlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shape used across the business-trip-report buttons: `blur={1}` and centred. */
export const Centered: Story = {
  render: () => (
    <Panel>
      <Overlay blur={1} center>
        <Button size="sm">Confirm</Button>
      </Overlay>
    </Panel>
  ),
};

export const WithoutBlur: Story = {
  render: () => (
    <Panel>
      <Overlay center>
        <span className="text-sm">No blur</span>
      </Overlay>
    </Panel>
  ),
};

export const Loading: Story = {
  render: () => (
    <Panel>
      <LoadingOverlay visible />
    </Panel>
  ),
};

/** Renders nothing at all, so the panel underneath stays interactive. */
export const LoadingHidden: Story = {
  render: () => (
    <Panel>
      <LoadingOverlay visible={false} />
    </Panel>
  ),
};
