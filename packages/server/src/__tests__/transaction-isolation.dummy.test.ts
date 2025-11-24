import { describe, test, expect } from 'vitest';
import { setupDbHooks, getTestClient } from './helpers/test-hooks.js';
import { qualifyTable } from './helpers/test-db-config.js';

// Register hooks (no admin seed needed for isolation demo)
setupDbHooks();

const TAG_NAME = 'dummy_test_tag_isolation';

async function countDummyTags() {
  const client = getTestClient();
  const res = await client.query(
    `SELECT COUNT(*)::int AS c FROM ${qualifyTable('tags')} WHERE name = $1`,
    [TAG_NAME],
  );
  return res.rows[0].c as number;
}

describe('transaction isolation (dummy)', () => {
  test('insert inside transaction is visible during test', async () => {
    const before = await countDummyTags();
    const client = getTestClient();
    await client.query(`INSERT INTO ${qualifyTable('tags')} (name) VALUES ($1)`, [TAG_NAME]);
    const during = await countDummyTags();
    expect(during).toBe(before + 1);
  });

  test('previous test insert rolled back (isolation)', async () => {
    const after = await countDummyTags();
    expect(after).toBe(0);
  });
});
