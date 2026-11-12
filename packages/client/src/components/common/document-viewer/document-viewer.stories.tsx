import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DocumentViewer } from './document-viewer.js';
import type { DocumentViewerSource } from './types.js';

/**
 * Builds an SVG "scan" as a data URI. The explicit `width`/`height` attributes give the image a
 * natural size in browsers, so the fit modes behave as they do for a real JPG. No network, no
 * binary fixtures.
 */
function scan(width: number, height: number, heading: string, lines: number): string {
  const lineHeight = Math.max(24, Math.round(width / 40));
  const rows = Array.from({ length: lines }, (_, i) => {
    const y = 200 + i * lineHeight * 1.6;
    const w = width * (0.5 + ((i * 37) % 40) / 100);
    return `<rect x="${width * 0.08}" y="${y}" width="${w}" height="${lineHeight * 0.5}" fill="#d4d4d8"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width * 0.08}" y="120" font-family="sans-serif" font-size="${lineHeight * 2}" fill="#111">${heading}</text>${rows}<text x="${width * 0.08}" y="${height - 80}" font-family="sans-serif" font-size="${lineHeight * 1.5}" fill="#111">Total ₪1,180.00</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ORIGINAL = 'https://example.com/original.pdf';

function Frame({ source }: { source: DocumentViewerSource }): ReactElement {
  return (
    <div className="h-180 w-160 border">
      <DocumentViewer source={source} documentKey={source.imageUrl ?? 'none'} onClose={() => {}} />
    </div>
  );
}

const meta = {
  title: 'Common/DocumentViewer',
  component: Frame,
} satisfies Meta<typeof Frame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An A4 invoice opens at Fit width; scroll down to read it. */
export const A4Portrait: Story = {
  args: {
    source: {
      imageUrl: scan(2480, 3508, 'ACME LTD — TAX INVOICE 1042', 40),
      fileUrl: ORIGINAL,
      title: 'Tax Invoice 1042',
      subtitle: '⁨Acme Ltd⁩ → ⁨Your Company Ltd⁩',
    },
  },
};

export const Landscape: Story = {
  args: {
    source: {
      imageUrl: scan(3508, 2480, 'STATEMENT — LANDSCAPE', 20),
      fileUrl: null,
      title: 'Other Document',
    },
  },
};

/** A tall thermal receipt: never upscaled, and Fit page shows it whole. */
export const LongReceipt: Story = {
  args: {
    source: {
      imageUrl: scan(576, 4000, 'RECEIPT 55', 60),
      fileUrl: null,
      title: 'Receipt 55',
      subtitle: '⁨קפה שלום⁩',
    },
  },
};

/** Smaller than the pane, so Fit width keeps it at its natural size. */
export const SmallImage: Story = {
  args: {
    source: {
      imageUrl: scan(300, 200, 'PHOTO', 2),
      fileUrl: null,
      title: 'Document',
    },
  },
};

export const BrokenUrl: Story = {
  args: {
    source: {
      imageUrl: '/__missing__/scan.jpg',
      fileUrl: ORIGINAL,
      title: 'Tax Invoice 7',
    },
  },
};

/** A file with no preview image. */
export const NoPreview: Story = {
  args: {
    source: {
      imageUrl: null,
      fileUrl: ORIGINAL,
      title: 'Invoice / Receipt 31',
    },
  },
};
