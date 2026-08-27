import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { DocumentType } from '../../../shared/enums.js';
import {
  releaseDbConnectionForExternalWork,
  resolveOwnerSideFromUuids,
  type OcrData,
} from './upload.helper.js';

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const ISSUER_ID = '00000000-0000-0000-0000-000000000002';
const RECIPIENT_ID = '00000000-0000-0000-0000-000000000003';

function ocr(overrides: Partial<OcrData> = {}): OcrData {
  return { documentType: DocumentType.Invoice, ...overrides };
}

describe('resolveOwnerSideFromUuids', () => {
  it('makes the matched issuer the counterparty when the owner is the recipient', () => {
    const data = ocr({ suggestedIssuer: ISSUER_ID, suggestedRecipient: OWNER_ID });
    resolveOwnerSideFromUuids(data, OWNER_ID);
    expect(data).toMatchObject({ isOwnerIssuer: false, counterpartyId: ISSUER_ID });
  });

  it('makes the matched recipient the counterparty when the owner is the issuer', () => {
    const data = ocr({ suggestedIssuer: OWNER_ID, suggestedRecipient: RECIPIENT_ID });
    resolveOwnerSideFromUuids(data, OWNER_ID);
    expect(data).toMatchObject({ isOwnerIssuer: true, counterpartyId: RECIPIENT_ID });
  });

  it('infers the owner side when only one side matched', () => {
    const issuerOnly = ocr({ suggestedIssuer: ISSUER_ID });
    resolveOwnerSideFromUuids(issuerOnly, OWNER_ID);
    expect(issuerOnly).toMatchObject({ isOwnerIssuer: false, counterpartyId: ISSUER_ID });

    const recipientOnly = ocr({ suggestedRecipient: RECIPIENT_ID });
    resolveOwnerSideFromUuids(recipientOnly, OWNER_ID);
    expect(recipientOnly).toMatchObject({ isOwnerIssuer: true, counterpartyId: RECIPIENT_ID });
  });

  it('never makes the owner its own counterparty', () => {
    // A model returning the owner UUID for both sides is a contradiction. Writing it
    // into counterpartyId would collapse both document sides onto the owner in
    // figureOutSides (creditor === debtor === owner).
    const data = ocr({ suggestedIssuer: OWNER_ID, suggestedRecipient: OWNER_ID });
    resolveOwnerSideFromUuids(data, OWNER_ID);
    expect(data.counterpartyId).toBeUndefined();
  });

  it('does not flip an already-resolved counterparty when both sides matched the owner', () => {
    // The email-ingestion path pre-sets counterpartyId from the grant's sender-email
    // match. A contradictory OCR result must not invert the sides around it.
    const data = ocr({
      counterpartyId: ISSUER_ID,
      suggestedIssuer: OWNER_ID,
      suggestedRecipient: OWNER_ID,
    });
    resolveOwnerSideFromUuids(data, OWNER_ID);
    expect(data.counterpartyId).toBe(ISSUER_ID);
    expect(data.isOwnerIssuer).toBeUndefined();
  });

  it('keeps a counterparty resolved by a higher-confidence source', () => {
    const data = ocr({
      counterpartyId: RECIPIENT_ID,
      suggestedIssuer: ISSUER_ID,
      suggestedRecipient: OWNER_ID,
    });
    resolveOwnerSideFromUuids(data, OWNER_ID);
    expect(data.counterpartyId).toBe(RECIPIENT_ID);
    // …while still orienting the sides from the OCR evidence.
    expect(data.isOwnerIssuer).toBe(false);
  });

  it('uses the OCR-derived isOwnerIssuer to disambiguate two non-owner matches', () => {
    const ownerIssued = ocr({
      isOwnerIssuer: true,
      suggestedIssuer: ISSUER_ID,
      suggestedRecipient: RECIPIENT_ID,
    });
    resolveOwnerSideFromUuids(ownerIssued, OWNER_ID);
    expect(ownerIssued.counterpartyId).toBe(RECIPIENT_ID);

    const ownerReceived = ocr({
      isOwnerIssuer: false,
      suggestedIssuer: ISSUER_ID,
      suggestedRecipient: RECIPIENT_ID,
    });
    resolveOwnerSideFromUuids(ownerReceived, OWNER_ID);
    expect(ownerReceived.counterpartyId).toBe(ISSUER_ID);

    // Unknown owner side + two non-owner matches stays ambiguous — nothing assigned.
    const ambiguous = ocr({ suggestedIssuer: ISSUER_ID, suggestedRecipient: RECIPIENT_ID });
    resolveOwnerSideFromUuids(ambiguous, OWNER_ID);
    expect(ambiguous.counterpartyId).toBeUndefined();
  });

  it('is a no-op when neither side matched a business', () => {
    const data = ocr();
    resolveOwnerSideFromUuids(data, OWNER_ID);
    expect(data).toEqual({ documentType: DocumentType.Invoice });
  });
});

describe('releaseDbConnectionForExternalWork', () => {
  it('releases the pooled connection before long external work', async () => {
    const releaseIdleConnection = vi.fn().mockResolvedValue(undefined);
    const injector = { get: () => ({ releaseIdleConnection }) } as unknown as Injector;

    await releaseDbConnectionForExternalWork(injector);

    expect(releaseIdleConnection).toHaveBeenCalledTimes(1);
  });

  it('never fails the upload when the client cannot be released', async () => {
    // Best-effort by design: this is a resource optimization, and an upload that
    // has already paid for a download and an OCR pass must not die for it.
    const injector = {
      get: () => {
        throw new Error('no client in this injector');
      },
    } as unknown as Injector;

    await expect(releaseDbConnectionForExternalWork(injector)).resolves.toBeUndefined();
  });
});
