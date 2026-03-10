import { describe, expect, it, vi } from 'vitest';
import { AuditLogsProvider } from '../audit-logs.provider.js';

describe('AuditLogsProvider.log', () => {
  it('inserts a row with all fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const provider = new AuditLogsProvider({ query } as never);

    await provider.log({
      ownerId: 'business-1',
      userId: 'user-1',
      auth0UserId: 'auth0|user-1',
      action: 'INVITATION_CREATED',
      entity: 'Invitation',
      entityId: 'inv-1',
      details: { email: 'user@example.com', roleId: 'employee' },
      ipAddress: '127.0.0.1',
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO accounter_schema.audit_logs');
    expect(values).toEqual([
      'business-1',
      'user-1',
      'auth0|user-1',
      'INVITATION_CREATED',
      'Invitation',
      'inv-1',
      JSON.stringify({ email: 'user@example.com', roleId: 'employee' }),
      '127.0.0.1',
    ]);
  });

  it('defaults nullable fields to NULL', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const provider = new AuditLogsProvider({ query } as never);

    await provider.log({
      action: 'USER_LOGIN',
    });

    const [, values] = query.mock.calls[0];
    expect(values).toEqual([null, null, null, 'USER_LOGIN', null, null, null, null]);
  });

  it('serializes details for JSONB storage', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const provider = new AuditLogsProvider({ query } as never);

    await provider.log({
      action: 'USER_ROLE_CHANGED',
      details: { from: 'employee', to: 'accountant' },
    });

    const [, values] = query.mock.calls[0];
    expect(values[6]).toBe(JSON.stringify({ from: 'employee', to: 'accountant' }));
  });

  it('uses explicit executor when provided', async () => {
    const defaultQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const overrideQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const provider = new AuditLogsProvider({ query: defaultQuery } as never);

    await provider.log({ action: 'API_KEY_CREATED' }, { query: overrideQuery } as never);

    expect(defaultQuery).not.toHaveBeenCalled();
    expect(overrideQuery).toHaveBeenCalledTimes(1);
  });
});
