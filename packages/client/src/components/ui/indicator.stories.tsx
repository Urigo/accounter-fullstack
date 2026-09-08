import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button.js';
import { Indicator } from './indicator.js';

const meta = {
  title: 'UI/Indicator',
  component: Indicator,
  parameters: { layout: 'centered' },
  args: { inline: true, size: 12, disabled: false, color: 'red' },
} satisfies Meta<typeof Indicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: <span className="text-sm">Invoice #4821</span> },
};

/** `disabled` is how every call site spells "nothing is wrong here". */
export const Disabled: Story = {
  args: { disabled: true, children: <span className="text-sm">Invoice #4821</span> },
};

/** The pending state, while a validation result is still resolving. */
export const Processing: Story = {
  args: { processing: true, children: <span className="text-sm">Invoice #4821</span> },
};

export const Colors: Story = {
  args: { children: null },
  render: args => (
    <div className="flex items-center gap-6">
      {(['red', 'orange', 'yellow', 'green', 'blue'] as const).map(color => (
        <Indicator key={color} {...args} color={color}>
          <span className="text-sm">{color}</span>
        </Indicator>
      ))}
    </div>
  ),
};

/** The filter-button case: a larger dot marking an active filter set. */
export const OnIconButton: Story = {
  args: {
    size: 16,
    children: (
      <Button variant="outline" size="icon">
        F
      </Button>
    ),
  },
};
