import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { ChargeTagsProvider } from '../../tags/providers/charge-tags.provider.js';
import { TagsProvider } from '../../tags/providers/tags.provider.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import {
  DEFAULT_NEW_UPLOAD_CHARGE_DESCRIPTION,
  uploadDocumentsToCharge,
  validateUploadTarget,
  type DocumentSource,
} from './upload-to-charge.helper.js';
import { getDocumentFromFile } from './upload.helper.js';

vi.mock('./upload.helper.js', () => ({
  getDocumentFromFile: vi.fn(),
  releaseDbConnectionForExternalWork: vi.fn(),
}));

vi.mock('../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const OWNER_ID = 'bb000000-0000-4000-8000-000000000001';
const EXISTING_CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const NEW_CHARGE_ID = 'cc000000-0000-4000-8000-000000000002';
const TAG_A = 'aa000000-0000-4000-8000-00000000000a';
const TAG_B = 'aa000000-0000-4000-8000-00000000000b';
const TX_CLIENT = { transactionClient: true };

const getDocumentFromFileMock = vi.mocked(getDocumentFromFile);

function setup({ knownTagIds = [TAG_A, TAG_B], insertFails = false } = {}) {
  const insertDocuments = vi.fn(
    async ({ documents }: { documents: Array<{ serialNumber: string; chargeId: string }> }) => {
      if (insertFails) {
        throw new Error('insert exploded');
      }
      return documents.map(document => ({
        id: `doc-${document.serialNumber}`,
        charge_id: document.chargeId,
      }));
    },
  );
  const generateCharge = vi.fn().mockResolvedValue({ id: NEW_CHARGE_ID });
  const insertChargeTag = vi.fn().mockResolvedValue([]);
  const transaction = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(TX_CLIENT));
  const loadMany = vi.fn(async (ids: string[]) =>
    ids.map(id => (knownTagIds.includes(id) ? { id } : undefined)),
  );

  const injector = {
    get: (token: unknown) => {
      switch (token) {
        case DocumentsProvider:
          return { insertDocuments };
        case ChargesProvider:
          return { generateCharge };
        case ChargeTagsProvider:
          return { insertChargeTag };
        case TagsProvider:
          return { getTagByIDLoader: { loadMany } };
        case TenantAwareDBClient:
          return { transaction };
        case AdminContextProvider:
          return { getVerifiedAdminContext: async () => ({ ownerId: OWNER_ID }) };
        default:
          throw new Error('unexpected provider requested');
      }
    },
  } as unknown as Injector;

  return { injector, insertDocuments, generateCharge, insertChargeTag, transaction };
}

/** A source named `<serial>.pdf`; a serial starting with `bad` fails processing. */
function source(serial: string): DocumentSource {
  return {
    label: `${serial}.pdf`,
    load: async () => new Blob([serial], { type: 'application/pdf' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The blob's text is the serial; delays and failures are keyed on it.
  getDocumentFromFileMock.mockImplementation(async (_injector, file, chargeId) => {
    const serial = await (file as Blob).text();
    if (serial.startsWith('bad')) {
      throw new Error('Error extracting document data from file', {
        cause: new Error('OCR refused'),
      });
    }
    // later inputs finish first, to prove results are not in completion order
    await new Promise(resolve => setTimeout(resolve, serial === 'one' ? 20 : 0));
    return { serialNumber: serial, chargeId: chargeId ?? null } as never;
  });
});

describe('validateUploadTarget', () => {
  it('refuses chargeId and newCharge together', async () => {
    const { injector } = setup();
    await expect(
      validateUploadTarget(injector, { chargeId: EXISTING_CHARGE_ID, newCharge: {} }),
    ).rejects.toThrow(/not both/);
  });

  it('refuses unknown tags, naming them', async () => {
    const { injector } = setup({ knownTagIds: [TAG_A] });
    await expect(
      validateUploadTarget(injector, { newCharge: { tagIds: [TAG_A, TAG_B] } }),
    ).rejects.toThrow(TAG_B);
  });

  it('de-duplicates tag ids', async () => {
    const { injector } = setup();
    await expect(
      validateUploadTarget(injector, { newCharge: { tagIds: [TAG_A, TAG_A, TAG_B] } }),
    ).resolves.toEqual([TAG_A, TAG_B]);
  });
});

describe('uploadDocumentsToCharge', () => {
  it('does no external work when the target is invalid', async () => {
    const { injector, generateCharge } = setup({ knownTagIds: [] });
    await expect(
      uploadDocumentsToCharge(injector, {
        sources: [source('one')],
        newCharge: { tagIds: [TAG_A] },
      }),
    ).rejects.toThrow(/Unknown tag/);
    expect(getDocumentFromFileMock).not.toHaveBeenCalled();
    expect(generateCharge).not.toHaveBeenCalled();
  });

  describe('existing charge', () => {
    it('keeps results in input order and reports a failure on its own position', async () => {
      const { injector, insertDocuments, generateCharge } = setup();

      const results = await uploadDocumentsToCharge(injector, {
        sources: [source('one'), source('bad-two'), source('three')],
        chargeId: EXISTING_CHARGE_ID,
      });

      expect(results).toEqual([
        { document: { id: 'doc-one', charge_id: EXISTING_CHARGE_ID } },
        {
          __typename: 'CommonError',
          message: 'bad-two.pdf: Error extracting document data from file: OCR refused',
        },
        { document: { id: 'doc-three', charge_id: EXISTING_CHARGE_ID } },
      ]);
      expect(insertDocuments).toHaveBeenCalledTimes(1);
      expect(generateCharge).not.toHaveBeenCalled();
      expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(injector, [EXISTING_CHARGE_ID]);
    });

    it('reports an insert failure on every processed position', async () => {
      const { injector } = setup({ insertFails: true });

      const results = await uploadDocumentsToCharge(injector, {
        sources: [source('one'), source('bad-two')],
        chargeId: EXISTING_CHARGE_ID,
      });

      expect(results).toEqual([
        {
          __typename: 'CommonError',
          message: 'one.pdf: failed storing the processed document: insert exploded',
        },
        {
          __typename: 'CommonError',
          message: 'bad-two.pdf: Error extracting document data from file: OCR refused',
        },
      ]);
      expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
    });
  });

  describe('new charge', () => {
    it('creates one charge with description and tags, in the same transaction as the documents', async () => {
      const { injector, generateCharge, insertChargeTag, insertDocuments, transaction } = setup();

      const results = await uploadDocumentsToCharge(injector, {
        sources: [source('one'), source('two')],
        newCharge: { userDescription: '  Deel payment REC-2026-19  ', tagIds: [TAG_A, TAG_B] },
      });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(generateCharge).toHaveBeenCalledWith(
        { ownerId: OWNER_ID, userDescription: 'Deel payment REC-2026-19' },
        TX_CLIENT,
      );
      expect(insertChargeTag).toHaveBeenCalledWith(
        { chargeId: NEW_CHARGE_ID, tagId: TAG_A },
        TX_CLIENT,
      );
      expect(insertChargeTag).toHaveBeenCalledWith(
        { chargeId: NEW_CHARGE_ID, tagId: TAG_B },
        TX_CLIENT,
      );
      expect(insertDocuments).toHaveBeenCalledWith(
        {
          documents: [
            { serialNumber: 'one', chargeId: NEW_CHARGE_ID },
            { serialNumber: 'two', chargeId: NEW_CHARGE_ID },
          ],
        },
        TX_CLIENT,
      );
      // documents are processed with no charge; it is assigned only at insert time
      expect(getDocumentFromFileMock).toHaveBeenCalledWith(
        injector,
        expect.anything(),
        null,
        undefined,
      );
      expect(results).toEqual([
        { document: { id: 'doc-one', charge_id: NEW_CHARGE_ID } },
        { document: { id: 'doc-two', charge_id: NEW_CHARGE_ID } },
      ]);
    });

    it('falls back to the default description', async () => {
      const { injector, generateCharge } = setup();

      await uploadDocumentsToCharge(injector, {
        sources: [source('one')],
        newCharge: { userDescription: '   ' },
      });
      await uploadDocumentsToCharge(injector, { sources: [source('one')] });

      expect(generateCharge).toHaveBeenNthCalledWith(
        1,
        { ownerId: OWNER_ID, userDescription: DEFAULT_NEW_UPLOAD_CHARGE_DESCRIPTION },
        TX_CLIENT,
      );
      expect(generateCharge).toHaveBeenNthCalledWith(
        2,
        { ownerId: OWNER_ID, userDescription: DEFAULT_NEW_UPLOAD_CHARGE_DESCRIPTION },
        TX_CLIENT,
      );
    });

    it('creates no charge when every document fails', async () => {
      const { injector, generateCharge, transaction } = setup();

      const results = await uploadDocumentsToCharge(injector, {
        sources: [source('bad-one'), source('bad-two')],
        newCharge: { userDescription: 'Fuel' },
      });

      expect(transaction).not.toHaveBeenCalled();
      expect(generateCharge).not.toHaveBeenCalled();
      expect(results.every(result => '__typename' in result)).toBe(true);
    });
  });
});
