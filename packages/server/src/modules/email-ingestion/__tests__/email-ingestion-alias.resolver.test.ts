import { describe, expect, it, vi } from 'vitest';
import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { ScopeProvider } from '../../auth/providers/scope.provider.js';
import { EmailIngestionAliasProvider } from '../providers/email-ingestion-alias.provider.js';
import { emailIngestionAliasResolver } from '../resolvers/email-ingestion-alias.resolver.js';

const row = {
  id: 'alias-uuid-1',
  alias: 'invoice@tenant.example.com',
  owner_id: 'tenant-uuid-1',
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

function makeInjector(opts: {
  scope?: Partial<ScopeProvider>;
  alias?: Partial<EmailIngestionAliasProvider>;
}): Injector {
  const scopeProvider: Partial<ScopeProvider> = {
    getReadScope: vi.fn().mockResolvedValue(['tenant-uuid-1']),
    resolveWriteTarget: vi.fn().mockResolvedValue('tenant-uuid-1'),
    ...opts.scope,
  };
  const aliasProvider: Partial<EmailIngestionAliasProvider> = {
    listAliases: vi.fn().mockResolvedValue([row]),
    createAlias: vi.fn().mockResolvedValue({ success: true, alias: row }),
    setAliasActive: vi.fn().mockResolvedValue({ success: true, alias: row }),
    ...opts.alias,
  };

  return {
    get: <T>(token: unknown): T => {
      if (token === ScopeProvider) return scopeProvider as unknown as T;
      if (token === EmailIngestionAliasProvider) return aliasProvider as unknown as T;
      throw new Error(`Unexpected provider: ${String(token)}`);
    },
  } as unknown as Injector;
}

describe('Query.emailIngestionAliases', () => {
  const resolver = emailIngestionAliasResolver.Query.emailIngestionAliases!;

  it('narrows scope by businessId arg and maps rows to GraphQL shape', async () => {
    const getReadScope = vi.fn().mockResolvedValue(['tenant-uuid-1']);
    const injector = makeInjector({ scope: { getReadScope } });

    const result = await resolver(
      {} as never,
      { businessId: 'tenant-uuid-1' },
      { injector } as never,
      {} as never,
    );

    expect(getReadScope).toHaveBeenCalledWith(['tenant-uuid-1']);
    expect(result).toEqual([
      {
        __typename: 'EmailIngestionAlias',
        id: 'alias-uuid-1',
        alias: 'invoice@tenant.example.com',
        ownerId: 'tenant-uuid-1',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('defaults to full read scope when no businessId is given', async () => {
    const getReadScope = vi.fn().mockResolvedValue(['a', 'b']);
    const listAliases = vi.fn().mockResolvedValue([]);
    const injector = makeInjector({ scope: { getReadScope }, alias: { listAliases } });

    await resolver({} as never, {}, { injector } as never, {} as never);

    expect(getReadScope).toHaveBeenCalledWith(undefined);
    expect(listAliases).toHaveBeenCalledWith(['a', 'b']);
  });
});

describe('Mutation.createEmailIngestionAlias', () => {
  const resolver = emailIngestionAliasResolver.Mutation.createEmailIngestionAlias!;

  it('validates write target, trims the alias, and returns the created alias', async () => {
    const resolveWriteTarget = vi.fn().mockResolvedValue('tenant-uuid-1');
    const createAlias = vi.fn().mockResolvedValue({ success: true, alias: row });
    const injector = makeInjector({ scope: { resolveWriteTarget }, alias: { createAlias } });

    const result = await resolver(
      {} as never,
      { input: { alias: '  invoice@tenant.example.com  ', businessId: 'tenant-uuid-1' } },
      { injector } as never,
      {} as never,
    );

    expect(resolveWriteTarget).toHaveBeenCalledWith('tenant-uuid-1');
    expect(createAlias).toHaveBeenCalledWith('invoice@tenant.example.com', 'tenant-uuid-1');
    expect(result).toMatchObject({ __typename: 'EmailIngestionAlias', id: 'alias-uuid-1' });
  });

  it('returns CommonError for an empty alias without touching the provider', async () => {
    const createAlias = vi.fn();
    const injector = makeInjector({ alias: { createAlias } });

    const result = await resolver(
      {} as never,
      { input: { alias: '   ', businessId: 'tenant-uuid-1' } },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(createAlias).not.toHaveBeenCalled();
  });

  it('surfaces a provider conflict as CommonError', async () => {
    const createAlias = vi
      .fn()
      .mockResolvedValue({ success: false, message: 'Alias "x" is already in use' });
    const injector = makeInjector({ alias: { createAlias } });

    const result = await resolver(
      {} as never,
      { input: { alias: 'x', businessId: 'tenant-uuid-1' } },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({ __typename: 'CommonError', message: expect.stringContaining('in use') });
  });

  it('propagates authorization failures from resolveWriteTarget', async () => {
    const resolveWriteTarget = vi.fn().mockRejectedValue(new GraphQLError('FORBIDDEN'));
    const injector = makeInjector({ scope: { resolveWriteTarget } });

    await expect(
      resolver(
        {} as never,
        { input: { alias: 'x', businessId: 'other' } },
        { injector } as never,
        {} as never,
      ),
    ).rejects.toThrow(GraphQLError);
  });
});

describe('Mutation.setEmailIngestionAliasActive', () => {
  const resolver = emailIngestionAliasResolver.Mutation.setEmailIngestionAliasActive!;

  it('returns the updated alias on success', async () => {
    const setAliasActive = vi
      .fn()
      .mockResolvedValue({ success: true, alias: { ...row, is_active: false } });
    const injector = makeInjector({ alias: { setAliasActive } });

    const result = await resolver(
      {} as never,
      { id: 'alias-uuid-1', isActive: false },
      { injector } as never,
      {} as never,
    );

    expect(setAliasActive).toHaveBeenCalledWith('alias-uuid-1', false);
    expect(result).toMatchObject({ __typename: 'EmailIngestionAlias', isActive: false });
  });

  it('returns CommonError when the alias is not found / not owned', async () => {
    const setAliasActive = vi
      .fn()
      .mockResolvedValue({ success: false, message: 'Alias not found or not authorized' });
    const injector = makeInjector({ alias: { setAliasActive } });

    const result = await resolver(
      {} as never,
      { id: 'missing', isActive: true },
      { injector } as never,
      {} as never,
    );

    expect(result).toMatchObject({ __typename: 'CommonError' });
  });
});
