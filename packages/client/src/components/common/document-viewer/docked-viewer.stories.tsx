import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { cn } from '@/lib/utils.js';
import { DockedViewerPanel } from './docked-viewer.js';
import type { DocumentViewerEntry } from './types.js';

/** An A4-shaped SVG "scan" with an explicit natural size, so Fit width behaves as for a real JPG. */
function scan(): string {
  const rows = Array.from(
    { length: 30 },
    (_, i) =>
      `<rect x="200" y="${400 + i * 90}" width="${1200 + ((i * 37) % 40) * 20}" height="36" fill="#d4d4d8"/>`,
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2480" height="3508" viewBox="0 0 2480 3508"><rect width="100%" height="100%" fill="#fff"/><text x="200" y="240" font-family="sans-serif" font-size="120" fill="#111">ACME LTD — TAX INVOICE 1042</text>${rows}<text x="200" y="3300" font-family="sans-serif" font-size="90" fill="#111">Total ₪1,180.00</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ENTRY: DocumentViewerEntry = {
  id: 'doc-1042',
  imageUrl: scan(),
  fileUrl: 'https://example.com/original.pdf',
  title: 'Tax Invoice 1042',
  subtitle: '⁨Acme Ltd⁩ → ⁨Your Company Ltd⁩',
};

/**
 * A stand-in for the dashboard's work area: a page column with a wide table beside the docked
 * column. Expanded state is local, not the global store, which would leak between stories.
 */
function WorkArea({
  initialExpanded = false,
  withStepper = false,
  className,
}: {
  initialExpanded?: boolean;
  /** Shows the `‹ 3/12 ›` stepper, stepping a local index (no store, so stories don't leak). */
  withStepper?: boolean;
  className?: string;
}): ReactElement {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [index, setIndex] = useState(2);
  return (
    <div className={cn('relative flex h-180 overflow-hidden border bg-gray-100', className)}>
      <div className="z-0 my-20 flex-1 overflow-scroll px-10">
        <table className="w-240 bg-white text-sm">
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i} className={cn('border-b', i === index && 'bg-blue-50')}>
                <td className="p-2">0{(i % 9) + 1}/10/2026</td>
                <td className="p-2">Tax Invoice {1040 + i}</td>
                <td className="p-2">Acme Ltd</td>
                <td className="p-2 text-right">₪{(1180 * (i + 1)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DockedViewerPanel
        entry={ENTRY}
        expanded={expanded}
        onToggleExpand={() => setExpanded(e => !e)}
        onClose={() => {}}
        stepper={
          withStepper
            ? {
                index,
                total: 12,
                onStep: delta => setIndex(i => Math.min(11, Math.max(0, i + delta))),
              }
            : undefined
        }
      />
    </div>
  );
}

const meta = {
  title: 'Common/DocumentViewer/Docked',
  component: WorkArea,
} satisfies Meta<typeof WorkArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1368px of work area, as at 1440px with the sidebar minimized: the column takes half (684px). */
export const Default: Story = {
  args: { className: 'w-342' },
};

/** Expand covers the page column; the section stays as a spacer, so the page doesn't reflow. */
export const Expanded: Story = {
  args: { className: 'w-342', initialExpanded: true },
};

/** A 900px work area: the column holds its 420px minimum and the page column keeps 480px. */
export const AtMinimum: Story = {
  args: { className: 'w-225' },
};

/** Opened from a table: the stepper walks its rows, and the highlight follows. */
export const WithStepper: Story = {
  args: { className: 'w-342', withStepper: true },
};
