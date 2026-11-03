import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../ui/button.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import { OverlayViewerFrame } from './overlay-viewer.js';
import type { OverlayMode } from './placement.js';
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
 * The overlay from props, with its open state local rather than in the global store, which would
 * leak between stories. Closing shows a button to reopen it.
 */
function OverlayStory({
  mode,
  overModal = false,
}: {
  mode: OverlayMode;
  /** Opens a `ui/dialog` first, as the issue-document dialog is, with the sheet above it. */
  overModal?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(true);
  const reopen = (
    <Button variant="outline" onClick={() => setOpen(true)}>
      Show the document
    </Button>
  );
  return (
    <>
      {overModal ? (
        <Dialog open>
          <DialogContent showCloseButton={false} className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit issue document</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              The modal stays visible on the left; Esc closes only the sheet above it.
            </p>
            {reopen}
          </DialogContent>
        </Dialog>
      ) : (
        reopen
      )}
      <OverlayViewerFrame entry={ENTRY} open={open} mode={mode} onClose={() => setOpen(false)} />
    </>
  );
}

const meta = {
  title: 'Common/DocumentViewer/Overlay',
  component: OverlayStory,
} satisfies Meta<typeof OverlayStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Under 1024px: the whole screen, with the toolbar on top and ✕ in the corner. */
export const FullScreen: Story = {
  args: { mode: 'fullscreen' },
};

/** Above an open modal: a full-height right sheet with no backdrop of its own. */
export const SheetOverModal: Story = {
  args: { mode: 'sheet', overModal: true },
};
