import { config } from 'dotenv';
import pg from 'pg';

config();

interface DemoWorkspace {
  companyName: string;
  logoUrl: string | null;
  defaultCurrency: string;
  agingThresholdDays: number;
  matchingToleranceAmount: number;
  billingCurrency: string | null;
  billingPaymentTermsDays: number;
  sources: Array<{
    provider: string;
    displayName: string;
    accountIdentifier: string | null;
    status: string;
    lastSyncAt: string | null;
    lastSyncError: string | null;
  }>;
}

const DEMO_WORKSPACES: DemoWorkspace[] = [
  {
    companyName: 'Sunrise Tech Ltd.',
    logoUrl: null,
    defaultCurrency: 'ILS',
    agingThresholdDays: 30,
    matchingToleranceAmount: 0.01,
    billingCurrency: 'ILS',
    billingPaymentTermsDays: 30,
    sources: [
      {
        provider: 'hapoalim',
        displayName: 'Hapoalim - Main Account',
        accountIdentifier: '****1234',
        status: 'active',
        lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        lastSyncError: null,
      },
      {
        provider: 'isracard',
        displayName: 'Isracard Business',
        accountIdentifier: '****5678',
        status: 'active',
        lastSyncAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        lastSyncError: null,
      },
      {
        provider: 'green_invoice',
        displayName: 'Green Invoice',
        accountIdentifier: null,
        status: 'active',
        lastSyncAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        lastSyncError: null,
      },
    ],
  },
  {
    companyName: 'BlueLine Consulting',
    logoUrl: 'https://ui-avatars.com/api/?name=BL&background=3b82f6&color=fff&size=128',
    defaultCurrency: 'USD',
    agingThresholdDays: 45,
    matchingToleranceAmount: 0.05,
    billingCurrency: 'USD',
    billingPaymentTermsDays: 60,
    sources: [
      {
        provider: 'mizrahi',
        displayName: 'Mizrahi - Operations',
        accountIdentifier: '****9012',
        status: 'active',
        lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        lastSyncError: null,
      },
      {
        provider: 'amex',
        displayName: 'Amex Corporate',
        accountIdentifier: '****3456',
        status: 'error',
        lastSyncAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        lastSyncError: 'Authentication expired - please update credentials',
      },
    ],
  },
];

async function seedDemoWorkspaces() {
  if (!process.env.ALLOW_DEMO_SEED) {
    console.error('Set ALLOW_DEMO_SEED=1 to run this script');
    process.exit(1);
  }

  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  try {
    await client.connect();

    const ownerResult = await client.query(`
      SELECT b.id
      FROM accounter_schema.businesses b
      JOIN accounter_schema.financial_entities fe ON fe.id = b.id
      WHERE fe.owner_id = fe.id
      ORDER BY fe.created_at ASC
      LIMIT 1
    `);

    if (ownerResult.rows.length === 0) {
      console.error('No owner business found. Run the main seed script first.');
      process.exit(1);
    }

    const ownerId = ownerResult.rows[0].id;
    console.log(`Found owner business: ${ownerId}`);

    for (const ws of DEMO_WORKSPACES) {
      console.log(`\nSeeding workspace: ${ws.companyName}`);

      await client.query(
        `INSERT INTO accounter_schema.workspace_settings
           (owner_id, company_name, logo_url, default_currency,
            aging_threshold_days, matching_tolerance_amount,
            billing_currency, billing_payment_terms_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (owner_id) DO UPDATE SET
           company_name = EXCLUDED.company_name,
           logo_url = EXCLUDED.logo_url,
           default_currency = EXCLUDED.default_currency,
           aging_threshold_days = EXCLUDED.aging_threshold_days,
           matching_tolerance_amount = EXCLUDED.matching_tolerance_amount,
           billing_currency = EXCLUDED.billing_currency,
           billing_payment_terms_days = EXCLUDED.billing_payment_terms_days,
           updated_at = NOW()`,
        [
          ownerId,
          ws.companyName,
          ws.logoUrl,
          ws.defaultCurrency,
          ws.agingThresholdDays,
          ws.matchingToleranceAmount,
          ws.billingCurrency,
          ws.billingPaymentTermsDays,
        ],
      );
      console.log(`  Workspace settings saved`);

      await client.query(
        `DELETE FROM accounter_schema.source_connections WHERE owner_id = $1`,
        [ownerId],
      );

      for (const src of ws.sources) {
        await client.query(
          `INSERT INTO accounter_schema.source_connections
             (owner_id, provider, display_name, account_identifier,
              status, last_sync_at, last_sync_error)
           VALUES ($1, $2::accounter_schema.source_provider, $3, $4,
                   $5::accounter_schema.source_connection_status, $6, $7)`,
          [
            ownerId,
            src.provider,
            src.displayName,
            src.accountIdentifier,
            src.status,
            src.lastSyncAt,
            src.lastSyncError,
          ],
        );
        console.log(`  Source: ${src.displayName} (${src.status})`);
      }

      console.log(`  Done with ${ws.companyName}`);
      break;
    }

    console.log('\nDemo workspace seeding complete.');
    console.log('Available demo profiles:');
    for (const ws of DEMO_WORKSPACES) {
      console.log(
        `  - ${ws.companyName}: ${ws.defaultCurrency}, ${ws.sources.length} sources${ws.logoUrl ? ', custom logo' : ''}`,
      );
    }
    console.log(
      '\nTo switch between profiles, re-run with a different workspace index.',
    );
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedDemoWorkspaces();
