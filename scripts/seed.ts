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
    }[] = [];

    if (
      process.env.SEED_BANK_ACCOUNT_NUMBER &&
      process.env.SEED_BANK_NUMBER &&
      process.env.SEED_BRANCH_NUMBER
    ) {
      accountsToCreate.push({
        account_number: parseInt(process.env.SEED_BANK_ACCOUNT_NUMBER),
        bank_number: parseInt(process.env.SEED_BANK_NUMBER),
        branch_number: parseInt(process.env.SEED_BRANCH_NUMBER),
        type: 'BANK_ACCOUNT',
        private_business: 'business',
        owner: adminEntityId,
      });
    }

    if (process.env.SEED_CREDIT_CARD_LAST4DIGITS) {
      accountsToCreate.push({
        account_number: parseInt(process.env.SEED_CREDIT_CARD_LAST4DIGITS),
        type: 'CREDIT_CARD',
        private_business: 'business',
        owner: adminEntityId,
      });
    }

    for (const account of accountsToCreate) {
      const financialAccountResult = await client.query(
        `
        INSERT INTO accounter_schema.financial_accounts 
        (account_number, type, private_business, owner, bank_number, branch_number)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
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

      const accountId = financialAccountResult.rows[0].id;

      const currencies = process.env.SEED_CURRENCIES?.split(',') || [];

      for (const currency of currencies) {
        console.log(
          `Creating tax category for account ${account.account_number} in ${currency}...`,
        );

        const financialEntityResult = await client.query(
          `INSERT INTO accounter_schema.financial_entities (name, owner_id, type)
          VALUES ($1, $2, $3)
          RETURNING id
          `,
          [`${account.account_number} - ${currency}`, adminEntityId, 'TAX_CATEGORY'],
        );

        const financialEntityId = financialEntityResult.rows[0].id;
        console.log(`✅ Created financial entity with ID: ${financialEntityId}`);

        const taxCategoryResult = await client.query(
          `INSERT INTO accounter_schema.tax_categories (id)
          VALUES ($1)
          RETURNING id`,
          [financialEntityId],
        );

        const taxCategoryId = taxCategoryResult.rows[0].id;
        console.log(`✅ Created tax category with ID: ${taxCategoryId}`);

        await client.query(
          `INSERT INTO accounter_schema.financial_accounts_tax_categories (financial_account_id, tax_category_id, currency)
          VALUES ($1, $2, $3)`,
          [accountId, taxCategoryId, currency],
        );
        console.log(
          `✅ Linked account ${accountId} with tax category ${taxCategoryId} for currency ${currency}`,
        );
      }

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
