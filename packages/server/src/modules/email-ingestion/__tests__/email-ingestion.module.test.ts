import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { emailIngestionModule } from '../index.js';
import { gmailListenerModule } from '../../gmail-listener/index.js';
import { emailIngestionResolvers } from '../resolvers/email-ingestion.resolver.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';

// ---------------------------------------------------------------------------
// Mock DI helpers
// ---------------------------------------------------------------------------

type MockProviders = {
  businessesProvider?: Partial<BusinessesProvider>;
  adminContextProvider?: Partial<AdminContextProvider>;
  documentsProvider?: Partial<DocumentsProvider>;
  chargesProvider?: Partial<ChargesProvider>;
  dbClient?: Partial<TenantAwareDBClient>;
};

function createMockInjector(providers: MockProviders = {}): Injector {
  const businessesProvider = {
    getBusinessByEmail: vi.fn().mockResolvedValue(null),
    ...providers.businessesProvider,
  };
  const adminContextProvider = {
    getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId: 'owner-1' }),
    ...providers.adminContextProvider,
  };
  const documentsProvider = {
    getDocumentByHash: { load: vi.fn().mockResolvedValue(null) },
    insertDocuments: vi.fn().mockResolvedValue([]),
    ...providers.documentsProvider,
  };
  const chargesProvider = {
    generateCharge: vi.fn().mockResolvedValue({ id: 'charge-1' }),
    ...providers.chargesProvider,
  };
  const dbClient = {
    transaction: vi.fn().mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
      fn({}),
    ),
    ...providers.dbClient,
  };

  return {
    get: <T>(token: unknown): T => {
      if (token === BusinessesProvider) return businessesProvider as unknown as T;
      if (token === AdminContextProvider) return adminContextProvider as unknown as T;
      if (token === DocumentsProvider) return documentsProvider as unknown as T;
      if (token === ChargesProvider) return chargesProvider as unknown as T;
      if (token === TenantAwareDBClient) return dbClient as unknown as T;
      throw new Error(`Unexpected provider: ${String(token)}`);
    },
  } as unknown as Injector;
}

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe('emailIngestionModule', () => {
  it('has the correct module id', () => {
    expect(emailIngestionModule.id).toBe('email-ingestion');
  });

  it('exports CommonTypes namespace', async () => {
    const { CommonTypes } = await import('../index.js');
    expect(CommonTypes).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe('gmailListenerModule (backward-compat alias)', () => {
  it('is the same module instance as emailIngestionModule', () => {
    expect(gmailListenerModule).toBe(emailIngestionModule);
  });
});

// ---------------------------------------------------------------------------
// businessEmailConfig resolver
// ---------------------------------------------------------------------------

describe('businessEmailConfig resolver', () => {
  const resolver = emailIngestionResolvers.Query!.businessEmailConfig!;

  it('returns null when no business matches the email', async () => {
    const injector = createMockInjector({
      businessesProvider: { getBusinessByEmail: vi.fn().mockResolvedValue(null) },
    });
    const result = await resolver({} as never, { email: 'unknown@example.com' }, { injector } as never, {} as never);
    expect(result).toBeNull();
  });

  it('returns businessId and empty config when business has no suggestion_data', async () => {
    const injector = createMockInjector({
      businessesProvider: {
        getBusinessByEmail: vi.fn().mockResolvedValue({
          id: 'biz-1',
          name: 'Test Business',
          suggestion_data: null,
        }),
      },
    });
    const result = await resolver({} as never, { email: 'test@example.com' }, { injector } as never, {} as never);
    expect(result).toMatchObject({ businessId: 'biz-1' });
    expect(result?.internalEmailLinks).toBeUndefined();
    expect(result?.emailBody).toBeUndefined();
  });

  it('returns emailListener config from valid suggestion_data', async () => {
    const suggestionData = {
      emailListener: {
        internalEmailLinks: ['partner@example.com'],
        emailBody: true,
        attachments: [],
      },
    };
    const injector = createMockInjector({
      businessesProvider: {
        getBusinessByEmail: vi.fn().mockResolvedValue({
          id: 'biz-2',
          name: 'Test Business',
          suggestion_data: suggestionData,
        }),
      },
    });
    const result = await resolver({} as never, { email: 'test@example.com' }, { injector } as never, {} as never);
    expect(result).toMatchObject({
      businessId: 'biz-2',
      internalEmailLinks: ['partner@example.com'],
      emailBody: true,
      attachments: [],
    });
  });
});

// ---------------------------------------------------------------------------
// insertEmailDocuments resolver
// ---------------------------------------------------------------------------

describe('insertEmailDocuments resolver', () => {
  const resolver = emailIngestionResolvers.Mutation!.insertEmailDocuments!;

  it('returns true immediately when documents array is empty', async () => {
    const injector = createMockInjector();
    const result = await resolver(
      {} as never,
      { documents: [], userDescription: 'test', messageId: null, businessId: null },
      { injector } as never,
      {} as never,
    );
    expect(result).toBe(true);
  });

  it('skips a document that already exists in the database (dedup by hash)', async () => {
    const existingDoc = { id: 'doc-existing' };
    const mockDoc = {
      text: vi.fn().mockResolvedValue('document-content'),
      name: 'invoice.pdf',
    } as unknown as File;

    const insertDocuments = vi.fn().mockResolvedValue([]);
    const injector = createMockInjector({
      documentsProvider: {
        getDocumentByHash: { load: vi.fn().mockResolvedValue(existingDoc) },
        insertDocuments,
      },
    });

    const result = await resolver(
      {} as never,
      { documents: [mockDoc], userDescription: 'test', messageId: 'msg-1', businessId: null },
      { injector } as never,
      {} as never,
    );

    expect(result).toBe(true);
    expect(insertDocuments).not.toHaveBeenCalled();
  });
});
