import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedProgress } from './segmented-progress.js';

/**
 * Replaced Mantine's `Progress` in its `sections` form. `ui/progress.tsx` covers the
 * single-value case; this one covers a bar split into labelled runs.
 */
const meta = {
  title: 'UI/SegmentedProgress',
  component: SegmentedProgress,
  parameters: { layout: 'padded' },
  // The bar is full-width by design, so an unconstrained canvas makes every segment look
  // roomy. This is nearer the width it gets on the approvals screen, where the narrow runs
  // actually have to clip.
  decorators: [
    Story => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SegmentedProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The accountant-approvals bar: approved / pending / unapproved of 240 charges. */
export const Default: Story = {
  args: {
    segments: [
      { id: 'approved', value: 62.5, className: 'bg-green-500', label: '62.5% (150)' },
      { id: 'pending', value: 20.8, className: 'bg-orange-500', label: '20.8% (50)' },
      { id: 'unapproved', value: 16.7, className: 'bg-red-500', label: '16.7% (40)' },
    ],
  },
};

/**
 * An even split, which is why segments are keyed by `id`: every label here is the same
 * string, so keying by label would collide.
 */
export const EvenSplit: Story = {
  args: {
    segments: [
      { id: 'approved', value: 33.3, className: 'bg-green-500', label: '33.3% (1)' },
      { id: 'pending', value: 33.3, className: 'bg-orange-500', label: '33.3% (1)' },
      { id: 'unapproved', value: 33.3, className: 'bg-red-500', label: '33.3% (1)' },
    ],
  },
};

/** Runs too narrow for their labels clip rather than wrap, keeping the bar one line tall. */
export const NarrowSegments: Story = {
  args: {
    segments: [
      { id: 'approved', value: 94, className: 'bg-green-500', label: '94.0% (235)' },
      { id: 'pending', value: 4, className: 'bg-orange-500', label: '4.0% (10)' },
      { id: 'unapproved', value: 2, className: 'bg-red-500', label: '2.0% (5)' },
    ],
  },
};

/** Segments need not fill the bar; the remainder shows the track. */
export const Partial: Story = {
  args: {
    segments: [{ id: 'done', value: 40, className: 'bg-blue-500', label: '40%' }],
  },
};

/** Labels are optional. */
export const Unlabelled: Story = {
  args: {
    segments: [
      { id: 'a', value: 50, className: 'bg-green-500' },
      { id: 'b', value: 30, className: 'bg-orange-500' },
    ],
  },
};
