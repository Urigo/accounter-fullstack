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

/** The system prompt a given generateText call was issued with. */
function systemPromptOf(callIndex: number): string {
  const { messages } = mockedGenerateText.mock.calls[callIndex]![0] as {
    messages: Array<{ role: string; content: unknown }>;
  };
  return String(messages.find(m => m.role === 'system')?.content);
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

  describe('when the catalog-bearing request fails', () => {
    it('retries without the catalog and keeps the extracted fields', async () => {
      mockedGenerateText
        .mockRejectedValueOnce(new Error('grammar too complex'))
        .mockResolvedValueOnce(
          modelReturns({
            type: DocumentType.Invoice,
            issuer: 'Some Unknown Supplier',
            fullAmount: 117,
            // The retry never saw the catalog, so a UUID here could only be a guess.
            issuerMatch: VENDOR_ID,
          }),
        );

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(mockedGenerateText).toHaveBeenCalledTimes(2);
      expect(systemPromptOf(0)).toContain('KNOWN BUSINESSES');
      expect(systemPromptOf(1)).not.toContain('KNOWN BUSINESSES');
      expect(result.fullAmount).toBe(117);
      expect(result.type).toBe(DocumentType.Invoice);
      expect(result.suggestedIssuer).toBeNull();
    });

    it('rejects when the catalog-free retry fails too', async () => {
      mockedGenerateText
        .mockRejectedValueOnce(new Error('first failure'))
        .mockRejectedValueOnce(new Error('second failure'));

      await expect(new AnthropicProvider().extractInvoiceDetails(pdf(), catalog)).rejects.toThrow(
        'Failed to extract document details: second failure',
      );
    });

    it('does not retry an identical request when there is no catalog to drop', async () => {
      mockedGenerateText.mockRejectedValueOnce(new Error('api down'));

      await expect(new AnthropicProvider().extractInvoiceDetails(pdf(), [])).rejects.toThrow(
        'Failed to extract document details: api down',
      );
      expect(mockedGenerateText).toHaveBeenCalledTimes(1);
    });
  });

  describe('model match', () => {
    it('is not accepted for a side the document does not have', async () => {
      mockedGenerateText.mockResolvedValueOnce(
        modelReturns({
          type: DocumentType.Invoice,
          issuer: 'Some Unknown Supplier',
          // No recipient was extracted, yet the model offered a catalog entry for it.
          recipientMatch: CUSTOMER_ID,
        }),
      );

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(result.suggestedRecipient).toBeNull();
    });

    it('is accepted for an extracted side the deterministic matcher left unresolved', async () => {
      mockedGenerateText.mockResolvedValueOnce(
        modelReturns({
          type: DocumentType.Invoice,
          issuer: 'Some Unknown Supplier',
          recipient: 'A name matchBusiness cannot resolve',
          recipientMatch: CUSTOMER_ID,
        }),
      );

      const result = await new AnthropicProvider().extractInvoiceDetails(pdf(), catalog);

      expect(result.suggestedRecipient).toBe(CUSTOMER_ID);
    });
  });
});
