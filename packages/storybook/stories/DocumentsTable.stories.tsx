import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { DocumentsTable } from '../src/components/documents-table';
import { DocumentType } from '../src/components/documents-table/types';
import {
  mockDocumentsData,
  mockEmptyDocumentsData,
  mockLargeDocumentsData,
  mockSingleDocumentData,
} from '../src/mocks/documents-data';

const meta = {
  title: 'Components/DocumentsTable',
  component: DocumentsTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A comprehensive documents table for displaying and managing financial documents with error indicators, suggestions, and file attachments. Built for accounting document processing.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      description: 'Array of document records to display',
      control: 'object',
    },
    onChange: {
      description: 'Callback when any document is updated',
      action: 'document-updated',
    },
  },
} satisfies Meta<typeof DocumentsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with mixed document states
export const Default: Story = {
  args: {
    data: mockDocumentsData,
    onChange: action('documents-updated'),
  },
};

// Empty state
export const Empty: Story = {
  args: {
    data: mockEmptyDocumentsData,
    onChange: action('documents-updated'),
  },
};

// Single document
export const SingleDocument: Story = {
  args: {
    data: mockSingleDocumentData,
    onChange: action('documents-updated'),
  },
};

// Large dataset for performance testing
export const LargeDataset: Story = {
  args: {
    data: mockLargeDocumentsData,
    onChange: action('documents-updated'),
  },
};

// Only invoices
export const InvoicesOnly: Story = {
  args: {
    data: mockDocumentsData.filter(doc => doc.documentType === DocumentType.Invoice),
    onChange: action('documents-updated'),
  },
};

// Only unprocessed documents (error states)
export const UnprocessedDocuments: Story = {
  args: {
    data: mockDocumentsData.filter(doc => doc.documentType === DocumentType.Unprocessed),
    onChange: action('documents-updated'),
  },
};

// Documents with suggestions
export const DocumentsWithSuggestions: Story = {
  args: {
    data: mockDocumentsData.filter(
      doc => 'missingInfoSuggestions' in doc && doc.missingInfoSuggestions,
    ),
    onChange: action('documents-updated'),
  },
};

// Documents with missing data (error indicators)
export const DocumentsWithErrors: Story = {
  args: {
    data: mockDocumentsData.filter(
      doc =>
        !doc.amount || !doc.creditor || !doc.debtor || !doc.date || !doc.vat || !doc.serialNumber,
    ),
    onChange: action('documents-updated'),
  },
};

// Credit invoices (negative amounts)
export const CreditInvoices: Story = {
  args: {
    data: mockDocumentsData.filter(doc => doc.documentType === DocumentType.CreditInvoice),
    onChange: action('documents-updated'),
  },
};

// Documents without files
export const DocumentsWithoutFiles: Story = {
  args: {
    data: mockDocumentsData.filter(doc => !doc.image || !doc.file),
    onChange: action('documents-updated'),
  },
};

// Document types showcase
export const DocumentTypesShowcase: Story = {
  args: {
    data: mockDocumentsData,
    onChange: action('documents-updated'),
  },
  render: () => (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-green-700">📄 Complete Invoices</h3>
        <DocumentsTable
          data={mockDocumentsData.filter(
            doc =>
              doc.documentType === DocumentType.Invoice && doc.amount && doc.creditor && doc.debtor,
          )}
          onChange={action('documents-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-yellow-700">
          ⚠️ Documents with Suggestions
        </h3>
        <DocumentsTable
          data={mockDocumentsData.filter(
            doc => 'missingInfoSuggestions' in doc && doc.missingInfoSuggestions,
          )}
          onChange={action('documents-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-red-700">🚨 Unprocessed Documents</h3>
        <DocumentsTable
          data={mockDocumentsData.filter(doc => doc.documentType === DocumentType.Unprocessed)}
          onChange={action('documents-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-blue-700">📊 Other Document Types</h3>
        <DocumentsTable
          data={mockDocumentsData.filter(doc =>
            ['Receipt', 'Proforma', 'Other'].includes(doc.documentType),
          )}
          onChange={action('documents-updated')}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

// Interactive example with custom handlers
export const InteractiveExample: Story = {
  args: {
    data: mockDocumentsData,
    onChange: () => {
      alert('Document updated! In a real application, this would refresh the data.');
    },
  },
  render: ({ data, onChange }) => (
    <div className="p-4">
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900">Interactive Demo</h3>
        <p className="text-blue-700 text-sm mb-2">
          This demo shows the interactive features of the documents table:
        </p>
        <ul className="text-blue-700 text-sm list-disc list-inside space-y-1">
          <li>Click the green checkmark buttons to accept AI suggestions</li>
          <li>Click business names to navigate to their details</li>
          <li>Click file icons to view documents</li>
          <li>Click edit icons to modify documents</li>
          <li>Click column headers to sort data</li>
        </ul>
      </div>
      <DocumentsTable data={data} onChange={onChange} />
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

// Currency showcase
export const CurrencyShowcase: Story = {
  args: {
    data: mockDocumentsData,
    onChange: action('documents-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how different currencies (USD, EUR, ILS) are displayed with proper formatting and color coding based on positive/negative amounts.',
      },
    },
  },
};

// Sorting demonstration
export const SortingDemo: Story = {
  args: {
    data: mockLargeDocumentsData.slice(0, 15),
    onChange: action('documents-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates sorting functionality. Click on any column header to sort. Dates, amounts, and text fields are all sortable.',
      },
    },
  },
};

// Error states showcase
export const ErrorStatesShowcase: Story = {
  args: {
    data: mockDocumentsData,
    onChange: action('documents-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how error indicators work. Red circles appear when required data is missing. Yellow backgrounds indicate AI suggestions are available.',
      },
    },
  },
};

// File attachments showcase
export const FileAttachmentsShowcase: Story = {
  args: {
    data: mockDocumentsData.filter(doc => doc.image || doc.file),
    onChange: action('documents-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates file attachment functionality. Click photo icons to view images, file icons to download PDFs. Missing files show error indicators.',
      },
    },
  },
};
