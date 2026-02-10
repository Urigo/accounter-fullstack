import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDatabase } from '../../../server/src/__tests__/helpers/test-database.js';
import { qualifyTable } from '../../../server/src/__tests__/helpers/test-db-config.js';

describe('RLS Charges Pilot', () => {
  let db: TestDatabase;

  const businessA = '00000000-0000-0000-0000-00000000000a';
  const businessB = '00000000-0000-0000-0000-00000000000b';
  const chargeA = '00000000-0000-0000-0000-00000000001a';
  const chargeB = '00000000-0000-0000-0000-00000000001b';

  beforeAll(async () => {
    db = new TestDatabase();
    await db.ensureLatestSchema();
  });

  afterAll(async () => {
    await db.close();
  });

  const setupData = async (client: any) => {
       // Insert Businesses
       await client.query(`
         INSERT INTO ${qualifyTable('financial_entities')} (id, name, type)
         VALUES ($1, 'Business A', 'business'), ($2, 'Business B', 'business')
         ON CONFLICT (id) DO NOTHING
       `, [businessA, businessB]);
       
       await client.query(`
         INSERT INTO ${qualifyTable('businesses')} (id)
         VALUES ($1), ($2)
         ON CONFLICT (id) DO NOTHING
       `, [businessA, businessB]);

       // Insert Charges (requires context setting for RLS)
       await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessA]);
       await client.query(`
         INSERT INTO ${qualifyTable('charges')} (id, owner_id, user_description)
         VALUES ($1, $2, 'Charge A')
         ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id
       `, [chargeA, businessA]);

       await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessB]);
       await client.query(`
         INSERT INTO ${qualifyTable('charges')} (id, owner_id, user_description)
         VALUES ($1, $2, 'Charge B')
         ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id
       `, [chargeB, businessB]);
  };

  it('should only see own charges when authenticated', async () => {
    await db.withTransaction(async client => {
      await setupData(client);

      // Set Context for Business A
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessA]);
      
      const res = await client.query(`SELECT id FROM ${qualifyTable('charges')}`);
      // Should see only A, not B
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].id).toBe(chargeA);
      
      // Verify helper function works
      const funcRes = await client.query(`SELECT accounter_schema.get_current_business_id() as id`);
      expect(funcRes.rows[0].id).toBe(businessA);
    });
  });

  it('should fail to see B charges as A', async () => {
    await db.withTransaction(async client => {
      await setupData(client);
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessA]);
      
      const res = await client.query(`SELECT id FROM ${qualifyTable('charges')} WHERE id = $1`, [chargeB]);
      expect(res.rows).toHaveLength(0);
    });
  });
  
  it('should switch context correctly', async () => {
    await db.withTransaction(async client => {
      await setupData(client);
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessB]);
      
      const res = await client.query(`SELECT id FROM ${qualifyTable('charges')}`);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].id).toBe(chargeB);
    });
  });

  it('should prevent inserting charge for other business', async () => {
    await db.withTransaction(async client => {
      await setupData(client);
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessA]);
      
      // Try to insert charge with owner = businessB
      await expect(client.query(`
        INSERT INTO ${qualifyTable('charges')} (owner_id, user_description) 
        VALUES ($1, 'Malicious Charge')
      `, [businessB])).rejects.toThrow(/violates row-level security policy/);
    });
  });

  it('should allow inserting charge for own business', async () => {
    await db.withTransaction(async client => {
      await setupData(client);
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessA]);
      
      const res = await client.query(`
        INSERT INTO ${qualifyTable('charges')} (owner_id, user_description) 
        VALUES ($1, 'Valid Charge') RETURNING id
      `, [businessA]);
      expect(res.rows).toHaveLength(1);
    });
  });

  it('should raise exception if context undefined', async () => {
    await db.withTransaction(async client => {
       // We don't need full setupData here, just query check
       // But setupData sets context, so we avoid calling it to test missing context.
       
       await setupData(client);
       
       // Force clear context (since setupData sets it to B at end)
       // set_config(..., true) is local to transaction.
       // Does set_config override previous set_config in same transaction? Yes.
       // Can we unset it? set_config('...', '', true) -> empty string -> helper function handles as NULL (if we coded it right).
       // Or set_config('...', NULL, true)? Postgres set_config value must be text.
       // Helper uses `NULLIF(current_setting(..., true), '')`.
       // So setting it to '' should trigger the error "No business context set" if helper throws on null.
       
       await client.query(`SELECT set_config('app.current_business_id', '', true)`);

       await expect(client.query(`SELECT * FROM ${qualifyTable('charges')}`))
         .rejects.toThrow('No business context set');
    });
  });

  it('performance: query plan should use index on owner_id', async () => {
    await db.withTransaction(async client => {
      await setupData(client);
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [businessA]);
      
      const res = await client.query(`EXPLAIN (FORMAT JSON) SELECT * FROM ${qualifyTable('charges')}`);
      const plan = res.rows[0]['QUERY PLAN'][0]['Plan'];

      const findIndexName = (node: any): boolean => {
        // Postgres index names might be schema qualified or not
        const idxName = node['Index Name'];
        if (idxName && (idxName.includes('charges_owner_id_idx') || idxName === 'charges_owner_id_idx')) return true;
        
        if (node.Plans) {
            return node.Plans.some(findIndexName);
        }
        return false;
      };
      
      const usedIndex = findIndexName(plan);
      if (!usedIndex) {
          console.log('Query Plan:', JSON.stringify(plan, null, 2));
      }
      expect(usedIndex).toBe(true);
    });
  });
});
