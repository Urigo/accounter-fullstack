import { generateText } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentType } from '../../../shared/enums.js';
import { AnthropicProvider } from '../anthropic.js';
import type { BusinessMatchData } from '../helpers/business-matcher.helper.js';

// Keep the real `ai` module (Output, types) and stub only the network call.
vi.mock('ai', async importOriginal => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}));

const mockedGenerateText = vi.mocked(generateText);

const VENDOR_ID = '00000000-0000-0000-0000-00000000000a';
const CUSTOMER_ID = '00000000-0000-0000-0000-00000000000b';
const UNKNOWN_ID = '00000000-0000-0000-0000-0000000000ff';

function business(id: string, name: string): BusinessMatchData {
  return { id, name, hebrew_name: null, vat_number: null, suggestion_data: null, locality: null };
}

const catalog = [business(VENDOR_ID, 'Vendor Ltd'), business(CUSTOMER_ID, 'Customer Inc')];

function pdf(): File {
  return new File([Buffer.from('%PDF-1.4 fake')], 'invoice.pdf', { type: 'application/pdf' });
}

const usage = {
  inputTokens: 100,
  outputTokens: 20,
  inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0 },
};

/** A generateText result carrying `output`, shaped as the provider reads it. */
function modelReturns(output: Record<string, unknown>) {
  return { output, usage } as unknown as Awaited<ReturnType<typeof generateText>>;
}

type SentMessage = { role: string; content: unknown; providerOptions?: unknown };

function messagesOf(callIndex: number): SentMessage[] {
  return (mockedGenerateText.mock.calls[callIndex]![0] as { messages: SentMessage[] }).messages;
}

function systemOf(callIndex: number): SentMessage {
  return messagesOf(callIndex).find(m => m.role === 'system')!;
}

function userOf(callIndex: number): SentMessage {
  return messagesOf(callIndex).find(m => m.role === 'user')!;
}

describe('AnthropicProvider.extractInvoiceDetails', () => {
  beforeEach(() => {
    mockedGenerateText.mockReset();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extraction', () => {
    it('sends the document without the catalog or a cache breakpoint', async () => {
      mockedGenerateText.mockResolvedValueOnce(
        modelReturns({ type: DocumentType.Invoice, issuer: 'Vendor Ltd', recipient: 'Customer Inc' }),
      );

      await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(String(systemOf(0).content)).not.toContain('KNOWN BUSINESSES');
      expect(systemOf(0).providerOptions).toBeUndefined();
      expect(userOf(0).content).toEqual([expect.objectContaining({ type: 'file' })]);
    });

    it('rejects when the extraction request fails', async () => {
      mockedGenerateText.mockRejectedValueOnce(new Error('api down'));

      await expect(new AnthropicProvider().extractInvoiceDetails(pdf(), catalog)).rejects.toThrow(
        'Failed to extract document details: api down',
      );
      expect(mockedGenerateText).toHaveBeenCalledTimes(1);
    });
  });

  describe('match call', () => {
    it('is skipped when the deterministic matcher resolves both sides', async () => {
      mockedGenerateText.mockResolvedValueOnce(
        modelReturns({ type: DocumentType.Invoice, issuer: 'Vendor Ltd', recipient: 'Customer Inc' }),
      );

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(mockedGenerateText).toHaveBeenCalledTimes(1);
      expect(result.suggestedIssuer).toBe(VENDOR_ID);
      expect(result.suggestedRecipient).toBe(CUSTOMER_ID);
    });

    it('is skipped for a non-financial document', async () => {
      mockedGenerateText.mockResolvedValueOnce(
        modelReturns({ type: DocumentType.Other, issuer: 'Some Unknown Supplier' }),
      );

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(mockedGenerateText).toHaveBeenCalledTimes(1);
      expect(result.suggestedIssuer).toBeNull();
    });

    it('is skipped when there is no catalog to match against', async () => {
      mockedGenerateText.mockResolvedValueOnce(
        modelReturns({ type: DocumentType.Invoice, issuer: 'Some Unknown Supplier' }),
      );

      await new AnthropicProvider().extractInvoiceDetails(pdf(), []);

      expect(mockedGenerateText).toHaveBeenCalledTimes(1);
    });

    it('is skipped when the unresolved side has no extracted name', async () => {
      mockedGenerateText.mockResolvedValueOnce(
        modelReturns({ type: DocumentType.Invoice, issuer: 'Vendor Ltd', recipient: '' }),
      );

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(mockedGenerateText).toHaveBeenCalledTimes(1);
      expect(result.suggestedRecipient).toBeNull();
    });

    it('sends the cached catalog and only the unresolved party, never the document', async () => {
      mockedGenerateText
        .mockResolvedValueOnce(
          modelReturns({
            type: DocumentType.Invoice,
            issuer: 'Some Unknown Supplier',
            issuerVatNumber: '514000000',
            recipient: 'Customer Inc',
            description: 'Annual subscription',
          }),
        )
        .mockResolvedValueOnce(modelReturns({ issuerMatch: VENDOR_ID }));

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(mockedGenerateText).toHaveBeenCalledTimes(2);
      expect(String(systemOf(1).content)).toContain(`${VENDOR_ID}|Vendor Ltd`);
      expect(systemOf(1).providerOptions).toEqual({
        anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } },
      });

      const userTurn = userOf(1).content;
      expect(typeof userTurn).toBe('string');
      expect(userTurn).toContain('Unmatched issuer: "Some Unknown Supplier"');
      expect(userTurn).toContain('514000000');
      expect(userTurn).toContain('Annual subscription');
      // Resolved deterministically, so not asked about.
      expect(userTurn).not.toContain('recipient');

      expect(result.suggestedIssuer).toBe(VENDOR_ID);
      expect(result.suggestedRecipient).toBe(CUSTOMER_ID);
    });

    it('ignores a match for a side it was not asked about', async () => {
      mockedGenerateText
        .mockResolvedValueOnce(
          modelReturns({ type: DocumentType.Invoice, issuer: 'Some Unknown Supplier' }),
        )
        // No recipient was extracted, yet the model offered a catalog entry for it.
        .mockResolvedValueOnce(modelReturns({ recipientMatch: CUSTOMER_ID }));

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(result.suggestedIssuer).toBeNull();
      expect(result.suggestedRecipient).toBeNull();
    });

    it('rejects a UUID that is not in the catalog', async () => {
      mockedGenerateText
        .mockResolvedValueOnce(
          modelReturns({ type: DocumentType.Invoice, issuer: 'Some Unknown Supplier' }),
        )
        .mockResolvedValueOnce(modelReturns({ issuerMatch: UNKNOWN_ID }));

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(result.suggestedIssuer).toBeNull();
    });

    it('keeps the extraction and the deterministic match when it fails', async () => {
      mockedGenerateText
        .mockResolvedValueOnce(
          modelReturns({
            type: DocumentType.Invoice,
            issuer: 'Some Unknown Supplier',
            recipient: 'Customer Inc',
            fullAmount: 117,
          }),
        )
        .mockRejectedValueOnce(new Error('overloaded'));

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(result.fullAmount).toBe(117);
      expect(result.type).toBe(DocumentType.Invoice);
      expect(result.suggestedIssuer).toBeNull();
      expect(result.suggestedRecipient).toBe(CUSTOMER_ID);
    });
  });
});
