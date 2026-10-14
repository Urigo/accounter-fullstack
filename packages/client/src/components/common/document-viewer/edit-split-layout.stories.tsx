import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import { SimpleGrid } from '../simple-grid.js';
import { DocumentViewer } from './document-viewer.js';
import { DocumentEditSplit } from './edit-split-layout.js';
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

const FIELDS = [
  'Type',
  'Serial',
  'Date',
  'Amount',
  'VAT',
  'Creditor',
  'Debtor',
  'Description',
  'Remarks',
  'Allocation number',
];

/**
 * A stand-in for the edit sheet's body: a 90vh-like frame with placeholder fields. Hidden state is
 * local, and the viewer comes from props, so nothing touches the global store.
 */
function EditSheetBody({
  entry = ENTRY,
  initialHidden = false,
}: {
  entry?: DocumentViewerEntry;
  initialHidden?: boolean;
}): ReactElement {
  const [hidden, setHidden] = useState(initialHidden);
  return (
    <div className="flex h-180 w-320 flex-col border bg-white">
      <div className="border-b p-4 text-lg">Edit Document</div>
      <DocumentEditSplit
        hidden={hidden}
        onHiddenChange={setHidden}
        form={
          <form className="px-5 pt-1">
            <SimpleGrid cols={hidden ? 4 : 2}>
              {FIELDS.map(field => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{field}</Label>
                  <Input id={field} />
                </div>
              ))}
            </SimpleGrid>
          </form>
        }
        viewer={({ onHide, onToggleExpand, expanded }) => (
          <DocumentViewer
            source={entry}
            documentKey={entry.id}
            closeVariant="hide"
            onClose={onHide}
            onToggleExpand={onToggleExpand}
            expanded={expanded}
          />
        )}
      />
    </div>
  );
}

const meta = {
  title: 'Common/DocumentViewer/EditSplit',
  component: EditSheetBody,
} satisfies Meta<typeof EditSheetBody>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Form and scan side by side, 50/50. Drag or arrow-key the handle; double-click resets. */
export const Default: Story = {};

/** The viewer collapsed to a strip with Show document; the form spreads to four columns. */
export const Hidden: Story = {
  args: { initialHidden: true },
};

/** Nothing attached: the pane stays, with room for PR 5's live image-URL preview. */
export const NoAttachment: Story = {
  args: { entry: { ...ENTRY, id: 'doc-empty', imageUrl: null, fileUrl: null } },
};
