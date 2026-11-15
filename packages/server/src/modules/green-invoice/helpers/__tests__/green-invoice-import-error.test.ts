import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import type { _DOLLAR_defs_Document } from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '../../../app-providers/green-invoice-client.js';
import { insertNewDocumentFromGreenInvoice } from '../green-invoice.helper.js';

describe('insertNewDocumentFromGreenInvoice', () => {
  it('keeps the Green Invoice document out of a failed import error', async () => {
    const document = {
      id: 'gi-doc-1',
      type: 305,
      amount: 1170,
      client: { id: 'gi-client-1', name: 'Sensitive Client Ltd', taxId: '512345678' },
    } as unknown as _DOLLAR_defs_Document;
    const injector = {
      get: vi.fn((token: unknown) => {
        if (token === GreenInvoiceClientProvider) {
          return { getDocumentLinks: vi.fn().mockResolvedValue({ en: 'https://files/doc.pdf' }) };
        }
        // Every other step fails the import.
        throw new Error('provider unavailable');
      }),
    } as unknown as Injector;

    const result = insertNewDocumentFromGreenInvoice(injector, document, 'owner-1');

    await expect(result).rejects.toThrow('gi-doc-1');
    const { message } = (await result.catch((e: unknown) => e)) as Error;
    expect(message).not.toContain('Sensitive Client Ltd');
    expect(message).not.toContain('512345678');
  });
});
