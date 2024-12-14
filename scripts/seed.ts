import { config } from 'dotenv';
import pg from 'pg';

config();

type FinancialAccountType = 'BANK_ACCOUNT' | 'CREDIT_CARD' | 'CRYPTO_WALLET';

async function seed() {
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

    // Create admin business entity
    const adminEntityResult = await client.query(`
      INSERT INTO accounter_schema.financial_entities (type, name)
      VALUES ('business', 'Admin Business')
      RETURNING id
    `);

    console.log('✅ Created admin business entity');

    const adminEntityId = adminEntityResult.rows[0].id;

    // Create corresponding business record
    await client.query(
      `
      INSERT INTO accounter_schema.businesses (id)
      VALUES ($1)
    `,
      [adminEntityId],
    );

    console.log('✅ Created corresponding business record');

    // update the owner_id of the admin entity
    await client.query(
      `
      UPDATE accounter_schema.financial_entities 
      SET owner_id = $1
      WHERE id = $1
    `,
      [adminEntityId],
    );

    console.log('✅ Updated admin business entity owner_id to itself');

    // Create bank accounts and credit cards
    const accountsToCreate: {
      account_number: number;
      type: FinancialAccountType;
      private_business: string;
      owner: string;
      bank_number?: number;
      branch_number?: number;
    }[] = [
      {
        account_number: 123_456,
        type: 'BANK_ACCOUNT',
        private_business: 'business',
        owner: adminEntityId,
        bank_number: 12,
        branch_number: 123,
      },
      {
        account_number: 123_457,
        type: 'CREDIT_CARD',
        private_business: 'business',
        owner: adminEntityId,
      },
    ];

    for (const account of accountsToCreate) {
      await client.query(
        `
        INSERT INTO accounter_schema.financial_accounts 
        (account_number, type, private_business, owner, bank_number, branch_number)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          account.account_number,
          account.type,
          account.private_business,
          account.owner,
          account.bank_number || null,
          account.branch_number || null,
        ],
      );

      console.log(`✅ Created financial account ${account.account_number}`);
    }

    console.log('✅ Financial accounts created successfully');
    console.log('✅ Admin business entity created successfully');
    console.log('🔑 Admin Entity ID:', adminEntityId);
    console.log('Add this ID to your .env file as DEFAULT_FINANCIAL_ENTITY_ID');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seed function
seed().catch(error => {
  console.error('Failed to seed database:', error);
  process.exit(1);
});
