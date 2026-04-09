import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUUID } from '../demo-fixtures/helpers/deterministic-uuid.js';
import { createAdminBusinessContext } from '../demo-fixtures/helpers/admin-context.js';

describe('createAdminBusinessContext', () => {
  const adminBusinessId = makeUUID('business', 'admin-business');
  const query = vi.fn();
  const client = { query } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a businesses_admin row for a newly seeded admin business', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await createAdminBusinessContext(client);

    expect(result).toBe(adminBusinessId);
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO accounter_schema.businesses_admin'),
      [adminBusinessId],
    );
  });

  it('backfills businesses_admin row when admin business already exists', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: adminBusinessId }] })
      .mockResolvedValueOnce({});

    const result = await createAdminBusinessContext(client);

    expect(result).toBe(adminBusinessId);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO accounter_schema.businesses_admin'),
      [adminBusinessId],
    );
  });
});
