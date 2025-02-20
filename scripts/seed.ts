/* eslint-disable unicorn/no-array-push-push */
import * as fs from 'node:fs';
import * as path from 'node:path';
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
      account_number: string;
      type: FinancialAccountType;
      private_business: string;
      owner: string;
      bank_number?: number;
      branch_number?: number;
    }[] = [];

    // Handle multiple bank accounts
    // SEED_BANK_ACCOUNT_NUMBER,
    // SEED_BANK_ACCOUNT_NUMBER_2,
    // ...
    for (let i = 1; i < 100; i++) {
      const suffix = i === 1 ? '' : `_${i}`;
      const accountNumber = process.env[`SEED_BANK_ACCOUNT_NUMBER${suffix}`];
      const bankNumber = process.env[`SEED_BANK_NUMBER${suffix}`];
      const branchNumber = process.env[`SEED_BRANCH_NUMBER${suffix}`];

      if (!accountNumber || !bankNumber || !branchNumber) break;

      accountsToCreate.push({
        account_number: accountNumber,
        bank_number: parseInt(bankNumber),
        branch_number: parseInt(branchNumber),
        type: 'BANK_ACCOUNT',
        private_business: 'business',
        owner: adminEntityId,
      });
    }

    // Handle multiple credit cards
    // SEED_CREDIT_CARD_LAST4DIGITS,
    // SEED_CREDIT_CARD_LAST4DIGITS_2,
    // ...
    for (let i = 1; i < 100; i++) {
      const suffix = i === 1 ? '' : `_${i}`;
      const last4digits = process.env[`SEED_CREDIT_CARD_LAST4DIGITS${suffix}`];

      if (!last4digits) break;

      accountsToCreate.push({
        account_number: last4digits,
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
          [`${account.account_number} - ${currency}`, adminEntityId, 'tax_category'],
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

      await seedCountries(client);
    }

    console.log('✅ Financial accounts created successfully');
    console.log('✅ Admin business entity created successfully');
    console.log(`🔑 Admin Entity ID: ${adminEntityId}`);
    await updateEnvFile('DEFAULT_FINANCIAL_ENTITY_ID', adminEntityId);
    await createAdminBusinessContext(client, adminEntityId);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function seedCountries(client: pg.Client) {
  // Check if countries table is empty before inserting
  const countryCount = await client.query(`
          SELECT COUNT(*) FROM accounter_schema.countries
        `);

  if (parseInt(countryCount.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO accounter_schema.countries (name, code)
      VALUES ('Afghanistan', 'AFG'),
            ('Albania', 'ALB'),
            ('Algeria', 'DZA'),
            ('American Samoa', 'ASM'),
            ('Andorra', 'AND'),
            ('Angola', 'AGO'),
            ('Anguilla', 'AIA'),
            ('Antarctica', 'ATA'),
            ('Antigua and Barbuda', 'ATG'),
            ('Argentina', 'ARG'),
            ('Armenia', 'ARM'),
            ('Aruba', 'ABW'),
            ('Australia', 'AUS'),
            ('Austria', 'AUT'),
            ('Azerbaijan', 'AZE'),
            ('Bahamas (the)', 'BHS'),
            ('Bahrain', 'BHR'),
            ('Bangladesh', 'BGD'),
            ('Barbados', 'BRB'),
            ('Belarus', 'BLR'),
            ('Belgium', 'BEL'),
            ('Belize', 'BLZ'),
            ('Benin', 'BEN'),
            ('Bermuda', 'BMU'),
            ('Bhutan', 'BTN'),
            ('Bolivia (Plurinational State of)', 'BOL'),
            ('Bonaire, Sint Eustatius and Saba', 'BES'),
            ('Bosnia and Herzegovina', 'BIH'),
            ('Botswana', 'BWA'),
            ('Bouvet Island', 'BVT'),
            ('Brazil', 'BRA'),
            ('British Indian Ocean Territory (the)', 'IOT'),
            ('Brunei Darussalam', 'BRN'),
            ('Bulgaria', 'BGR'),
            ('Burkina Faso', 'BFA'),
            ('Burundi', 'BDI'),
            ('Cabo Verde', 'CPV'),
            ('Cambodia', 'KHM'),
            ('Cameroon', 'CMR'),
            ('Canada', 'CAN'),
            ('Cayman Islands (the)', 'CYM'),
            ('Central African Republic (the)', 'CAF'),
            ('Chad', 'TCD'),
            ('Chile', 'CHL'),
            ('China', 'CHN'),
            ('Christmas Island', 'CXR'),
            ('Cocos (Keeling) Islands (the)', 'CCK'),
            ('Colombia', 'COL'),
            ('Comoros (the)', 'COM'),
            ('Congo (the Democratic Republic of the)', 'COD'),
            ('Congo (the)', 'COG'),
            ('Cook Islands (the)', 'COK'),
            ('Costa Rica', 'CRI'),
            ('Croatia', 'HRV'),
            ('Cuba', 'CUB'),
            ('Curaçao', 'CUW'),
            ('Cyprus', 'CYP'),
            ('Czechia', 'CZE'),
            ('Côte d''Ivoire', 'CIV'),
            ('Denmark', 'DNK'),
            ('Djibouti', 'DJI'),
            ('Dominica', 'DMA'),
            ('Dominican Republic (the)', 'DOM'),
            ('Ecuador', 'ECU'),
            ('Egypt', 'EGY'),
            ('El Salvador', 'SLV'),
            ('Equatorial Guinea', 'GNQ'),
            ('Eritrea', 'ERI'),
            ('Estonia', 'EST'),
            ('Eswatini', 'SWZ'),
            ('Ethiopia', 'ETH'),
            ('Falkland Islands (the) [Malvinas]', 'FLK'),
            ('Faroe Islands (the)', 'FRO'),
            ('Fiji', 'FJI'),
            ('Finland', 'FIN'),
            ('France', 'FRA'),
            ('French Guiana', 'GUF'),
            ('French Polynesia', 'PYF'),
            ('French Southern Territories (the)', 'ATF'),
            ('Gabon', 'GAB'),
            ('Gambia (the)', 'GMB'),
            ('Georgia', 'GEO'),
            ('Germany', 'DEU'),
            ('Ghana', 'GHA'),
            ('Gibraltar', 'GIB'),
            ('Greece', 'GRC'),
            ('Greenland', 'GRL'),
            ('Grenada', 'GRD'),
            ('Guadeloupe', 'GLP'),
            ('Guam', 'GUM'),
            ('Guatemala', 'GTM'),
            ('Guernsey', 'GGY'),
            ('Guinea', 'GIN'),
            ('Guinea-Bissau', 'GNB'),
            ('Guyana', 'GUY'),
            ('Haiti', 'HTI'),
            ('Heard Island and McDonald Islands', 'HMD'),
            ('Holy See (the)', 'VAT'),
            ('Honduras', 'HND'),
            ('Hong Kong', 'HKG'),
            ('Hungary', 'HUN'),
            ('Iceland', 'ISL'),
            ('India', 'IND'),
            ('Indonesia', 'IDN'),
            ('Iran (Islamic Republic of)', 'IRN'),
            ('Iraq', 'IRQ'),
            ('Ireland', 'IRL'),
            ('Isle of Man', 'IMN'),
            ('Israel', 'ISR'),
            ('Italy', 'ITA'),
            ('Jamaica', 'JAM'),
            ('Japan', 'JPN'),
            ('Jersey', 'JEY'),
            ('Jordan', 'JOR'),
            ('Kazakhstan', 'KAZ'),
            ('Kenya', 'KEN'),
            ('Kiribati', 'KIR'),
            ('Korea (the Democratic People''s Republic of)', 'PRK'),
            ('Korea (the Republic of)', 'KOR'),
            ('Kuwait', 'KWT'),
            ('Kyrgyzstan', 'KGZ'),
            ('Lao People''s Democratic Republic (the)', 'LAO'),
            ('Latvia', 'LVA'),
            ('Lebanon', 'LBN'),
            ('Lesotho', 'LSO'),
            ('Liberia', 'LBR'),
            ('Libya', 'LBY'),
            ('Liechtenstein', 'LIE'),
            ('Lithuania', 'LTU'),
            ('Luxembourg', 'LUX'),
            ('Macao', 'MAC'),
            ('Madagascar', 'MDG'),
            ('Malawi', 'MWI'),
            ('Malaysia', 'MYS'),
            ('Maldives', 'MDV'),
            ('Mali', 'MLI'),
            ('Malta', 'MLT'),
            ('Marshall Islands (the)', 'MHL'),
            ('Martinique', 'MTQ'),
            ('Mauritania', 'MRT'),
            ('Mauritius', 'MUS'),
            ('Mayotte', 'MYT'),
            ('Mexico', 'MEX'),
            ('Micronesia (Federated States of)', 'FSM'),
            ('Moldova (the Republic of)', 'MDA'),
            ('Monaco', 'MCO'),
            ('Mongolia', 'MNG'),
            ('Montenegro', 'MNE'),
            ('Montserrat', 'MSR'),
            ('Morocco', 'MAR'),
            ('Mozambique', 'MOZ'),
            ('Myanmar', 'MMR'),
            ('Namibia', 'NAM'),
            ('Nauru', 'NRU'),
            ('Nepal', 'NPL'),
            ('Netherlands (the)', 'NLD'),
            ('New Caledonia', 'NCL'),
            ('New Zealand', 'NZL'),
            ('Nicaragua', 'NIC'),
            ('Niger (the)', 'NER'),
            ('Nigeria', 'NGA'),
            ('Niue', 'NIU'),
            ('Norfolk Island', 'NFK'),
            ('Northern Mariana Islands (the)', 'MNP'),
            ('Norway', 'NOR'),
            ('Oman', 'OMN'),
            ('Pakistan', 'PAK'),
            ('Palau', 'PLW'),
            ('Palestine, State of', 'PSE'),
            ('Panama', 'PAN'),
            ('Papua New Guinea', 'PNG'),
            ('Paraguay', 'PRY'),
            ('Peru', 'PER'),
            ('Philippines (the)', 'PHL'),
            ('Pitcairn', 'PCN'),
            ('Poland', 'POL'),
            ('Portugal', 'PRT'),
            ('Puerto Rico', 'PRI'),
            ('Qatar', 'QAT'),
            ('Republic of North Macedonia', 'MKD'),
            ('Romania', 'ROU'),
            ('Russian Federation (the)', 'RUS'),
            ('Rwanda', 'RWA'),
            ('Réunion', 'REU'),
            ('Saint Barthélemy', 'BLM'),
            ('Saint Helena, Ascension and Tristan da Cunha', 'SHN'),
            ('Saint Kitts and Nevis', 'KNA'),
            ('Saint Lucia', 'LCA'),
            ('Saint Martin (French part)', 'MAF'),
            ('Saint Pierre and Miquelon', 'SPM'),
            ('Saint Vincent and the Grenadines', 'VCT'),
            ('Samoa', 'WSM'),
            ('San Marino', 'SMR'),
            ('Sao Tome and Principe', 'STP'),
            ('Saudi Arabia', 'SAU'),
            ('Senegal', 'SEN'),
            ('Serbia', 'SRB'),
            ('Seychelles', 'SYC'),
            ('Sierra Leone', 'SLE'),
            ('Singapore', 'SGP'),
            ('Sint Maarten (Dutch part)', 'SXM'),
            ('Slovakia', 'SVK'),
            ('Slovenia', 'SVN'),
            ('Solomon Islands', 'SLB'),
            ('Somalia', 'SOM'),
            ('South Africa', 'ZAF'),
            ('South Georgia and the South Sandwich Islands', 'SGS'),
            ('South Sudan', 'SSD'),
            ('Spain', 'ESP'),
            ('Sri Lanka', 'LKA'),
            ('Sudan (the)', 'SDN'),
            ('Suriname', 'SUR'),
            ('Svalbard and Jan Mayen', 'SJM'),
            ('Sweden', 'SWE'),
            ('Switzerland', 'CHE'),
            ('Syrian Arab Republic', 'SYR'),
            ('Taiwan (Province of China)', 'TWN'),
            ('Tajikistan', 'TJK'),
            ('Tanzania, United Republic of', 'TZA'),
            ('Thailand', 'THA'),
            ('Timor-Leste', 'TLS'),
            ('Togo', 'TGO'),
            ('Tokelau', 'TKL'),
            ('Tonga', 'TON'),
            ('Trinidad and Tobago', 'TTO'),
            ('Tunisia', 'TUN'),
            ('Turkey', 'TUR'),
            ('Turkmenistan', 'TKM'),
            ('Turks and Caicos Islands (the)', 'TCA'),
            ('Tuvalu', 'TUV'),
            ('Uganda', 'UGA'),
            ('Ukraine', 'UKR'),
            ('United Arab Emirates (the)', 'ARE'),
            ('United Kingdom of Great Britain and Northern Ireland (the)', 'GBR'),
            ('United States Minor Outlying Islands (the)', 'UMI'),
            ('United States of America (the)', 'USA'),
            ('Uruguay', 'URY'),
            ('Uzbekistan', 'UZB'),
            ('Vanuatu', 'VUT'),
            ('Venezuela (Bolivarian Republic of)', 'VEN'),
            ('Viet Nam', 'VNM'),
            ('Virgin Islands (British)', 'VGB'),
            ('Virgin Islands (U.S.)', 'VIR'),
            ('Wallis and Futuna', 'WLF'),
            ('Western Sahara', 'ESH'),
            ('Yemen', 'YEM'),
            ('Zambia', 'ZMB'),
            ('Zimbabwe', 'ZWE'),
            ('Åland Islands', 'ALA');
    `);

    console.log(`✅ All countries have been successfully inserted`);
  } else {
    console.log('ℹ️ Countries table already populated, skipping insertion');
  }
}

async function updateEnvFile(key: string, value: string) {
  const envPath = path.resolve(process.cwd(), '.env');

  try {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Check if the variable already exists
    if (envContent.match(new RegExp(`^${key}=`, 'm'))) {
      // Replace existing value
      envContent = envContent.replace(new RegExp(`^${key}=.*`, 'm'), `${key}=${value}`);
    } else {
      // Add new value
      envContent += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env file with ${key}`);
  } catch (error) {
    console.warn(`⚠️ Failed to update .env file for ${key}:`, error);
  }
}

type ContextOptions = {
  bankDeposits: boolean;
  salaries: boolean;
  businessTrips: boolean;
  dividends: boolean;
  depreciation: boolean;
};

async function createAdminBusinessContext(
  client: pg.Client,
  adminEntityId: string,
  options: Partial<ContextOptions> = {},
) {
  const enrichedOptions = {
    bankDeposits: true,
    salaries: true,
    businessTrips: true,
    dividends: true,
    depreciation: true,
    ...options,
  };

  const requiredEntities = {
    authorities: {
      businesses: ['VAT', 'Tax', 'Social Security'],
      taxCategories: ['Input Vat', 'Output Vat', 'Tax Expenses'],
    },
    general: {
      taxCategories: [
        'DEFAULT (missing)',
        'Exchange Rates',
        'Income Exchange Rates',
        'Exchange Revaluation',
        'Fee',
        'General Fee',
        'Fine',
        'Untaxable Gifts',
        'Balance Cancellation',
        'Development Foreign',
        'Development Local',
        'Salary Excess Expenses',
      ],
    },
    crossYear: {
      taxCategories: [
        'Expenses to Pay',
        'Expenses in Advance',
        'Income to Collect',
        'Income in Advance',
      ],
    },
    financialAccounts: {
      businesses: [
        'Poalim',
        'Discount',
        'Swift',
        'Isracard',
        'Amex',
        'CAL',
        'Etana',
        'Kraken',
        'EtherScan',
      ],
    },
    bankDeposits: {
      businesses: ['Bank Deposit'],
      taxCategories: ['Bank Deposit Interest Income'],
    },
    salaries: {
      businesses: ['Batched Employees', 'Batched Funds', 'Tax Deductions'],
      taxCategories: [
        'Zkufot Expenses',
        'Zkufot Income',
        'Social Security Expenses',
        'Salary Expenses',
        'Training Fund',
        'Compensation Fund',
        'Pension Expenses',
        'Recovery Reserve Tax',
        'Recovery Reserve Expenses',
        'Vacation Reserve Tax',
        'Vacation Reserve Expenses',
      ],
    },
    businessTrips: {
      taxCategories: ['Business Trip'],
      tags: ['Business Trip'],
    },
    dividends: {
      businesses: ['Dividends Withholding Tax'],
      taxCategories: ['Dividend'],
    },
    depreciation: {
      taxCategories: [
        'Accumulated Depreciation',
        'R&D Depreciation',
        'G&M Depreciation',
        'Marketing Depreciation',
      ],
    },
  };

  const taxCategories: string[] = [];
  const businesses: string[] = [];
  const tagNames: string[] = [];

  // Authorities
  businesses.push(...requiredEntities.authorities.businesses);
  taxCategories.push(...requiredEntities.authorities.taxCategories);

  // General tax categories
  taxCategories.push(...requiredEntities.general.taxCategories);

  // Cross year tax categories
  taxCategories.push(...requiredEntities.crossYear.taxCategories);

  // Financial Accounts
  businesses.push(...requiredEntities.financialAccounts.businesses);

  if (enrichedOptions.bankDeposits) {
    businesses.push(...requiredEntities.bankDeposits.businesses);
    taxCategories.push(...requiredEntities.bankDeposits.taxCategories);
  }

  if (enrichedOptions.salaries) {
    businesses.push(...requiredEntities.salaries.businesses);
    taxCategories.push(...requiredEntities.salaries.taxCategories);
  }

  if (enrichedOptions.businessTrips) {
    tagNames.push(...requiredEntities.businessTrips.tags);
    taxCategories.push(...requiredEntities.businessTrips.taxCategories);
  }

  if (enrichedOptions.dividends) {
    businesses.push(...requiredEntities.dividends.businesses);
    taxCategories.push(...requiredEntities.dividends.taxCategories);
  }

  if (enrichedOptions.depreciation) {
    taxCategories.push(...requiredEntities.depreciation.taxCategories);
  }

  // Create financial entities
  const financialEntities: { id: string; name: string; type: string }[] = [];
  try {
    const res = await client.query<{ id: string; name: string; type: string }>(`
      INSERT INTO accounter_schema.financial_entities (type, name)
      VALUES ${[...businesses.map(business => `('business', '${business}')`), ...taxCategories.map(taxCategory => `('tax_category', '${taxCategory}')`)].join(',')}
      RETURNING id, name, type
    `);
    financialEntities.push(...res.rows);
  } catch (e) {
    console.error('Failed to create financial entities:', e);
    throw new Error('Failed to create financial entities');
  }

  if (financialEntities.length === 0) {
    throw new Error('Failed to create financial entities');
  }
  console.log('✅ Required financial entities created successfully');

  // Create businesses
  const businessesIds = financialEntities
    .filter(entity => entity.type === 'business')
    .map(entity => entity.id);
  try {
    const res = await client.query<{ id: string }>(`
        INSERT INTO accounter_schema.businesses (id, no_invoices_required)
        VALUES ${businessesIds.map(id => `('${id}',TRUE)`).join(',')}
        RETURNING id
      `);
    if (res.rows.length !== businessesIds.length) {
      throw new Error('Created businesses number mismatch');
    }
  } catch (e) {
    console.error('Failed to create businesses:', e);
    throw new Error('Failed to create businesses');
  }
  console.log('✅ Required businesses created successfully');

  // Create tax categories
  const taxCategoryIds = financialEntities
    .filter(entity => entity.type === 'tax_category')
    .map(entity => entity.id);
  try {
    const res = await client.query<{ id: string }>(`
        INSERT INTO accounter_schema.tax_categories (id)
        VALUES ${taxCategoryIds.map(id => `('${id}')`).join(',')}
        RETURNING id
      `);
    if (res.rows.length !== taxCategoryIds.length) {
      throw new Error('Created tax categories number mismatch');
    }
  } catch (e) {
    console.error('Failed to create tax categories:', e);
    throw new Error('Failed to create tax categories');
  }
  console.log('✅ Required tax categories created successfully');

  // Create tags
  const tags: { id: string; name: string }[] = [];
  try {
    const res = await client.query<{ id: string; name: string }>(`
        INSERT INTO accounter_schema.tags (name)
        VALUES ${tagNames.map(tag => `('${tag}')`).join(',')}
        RETURNING id, name
      `);
    if (res.rows.length !== tagNames.length) {
      throw new Error('Created tags number mismatch');
    }
    tags.push(...res.rows);
  } catch (e) {
    console.error('Failed to create tags:', e);
    throw new Error('Failed to create tags');
  }
  console.log('✅ Required tags created successfully');

  function findId<T extends boolean, R = T extends true ? string | null : string>(
    name: string,
    type: 'tag' | 'business' | 'tax_category',
    nullable: T = false as T,
  ): R {
    let id: string | null = null;
    if (type === 'tag') {
      id = tags.find(tag => tag.name === name)?.id ?? null;
    } else {
      id =
        financialEntities.find(entity => entity.name === name && entity.type === type)?.id ?? null;
    }
    if (!nullable && !id) {
      throw new Error(`Failed to find ${type} id for ${name}`);
    }
    return id as R;
  }

  const context = {
    default_tax_category_id: findId('DEFAULT (missing)', 'tax_category'),
    vat_business_id: findId('VAT', 'business'),
    input_vat_tax_category_id: findId('Input Vat', 'tax_category'),
    output_vat_tax_category_id: findId('Output Vat', 'tax_category'),
    tax_business_id: findId('Tax', 'business'),
    tax_expenses_tax_category_id: findId('Tax Expenses', 'tax_category'),
    social_security_business_id: findId('Social Security', 'business'),
    exchange_rate_tax_category_id: findId('Exchange Rates', 'tax_category'),
    income_exchange_rate_tax_category_id: findId('Income Exchange Rates', 'tax_category'),
    exchange_rate_revaluation_tax_category_id: findId('Exchange Revaluation', 'tax_category'),
    fee_tax_category_id: findId('Fee', 'tax_category'),
    general_fee_tax_category_id: findId('General Fee', 'tax_category'),
    fine_tax_category_id: findId('Fine', 'tax_category'),
    untaxable_gifts_tax_category_id: findId('Untaxable Gifts', 'tax_category'),
    balance_cancellation_tax_category_id: findId('Balance Cancellation', 'tax_category'),
    development_foreign_tax_category_id: findId('Development Foreign', 'tax_category'),
    development_local_tax_category_id: findId('Development Local', 'tax_category'),
    accumulated_depreciation_tax_category_id: findId(
      'Accumulated Depreciation',
      'tax_category',
      true,
    ),
    rnd_depreciation_expenses_tax_category_id: findId('R&D Depreciation', 'tax_category', true),
    gnm_depreciation_expenses_tax_category_id: findId('G&M Depreciation', 'tax_category', true),
    marketing_depreciation_expenses_tax_category_id: findId(
      'Marketing Depreciation',
      'tax_category',
      true,
    ),
    bank_deposit_interest_income_tax_category_id: findId(
      'Bank Deposit Interest Income',
      'tax_category',
      true,
    ),
    business_trip_tax_category_id: findId('Business Trip', 'tax_category', true),
    business_trip_tag_id: findId('Business Trip', 'tag', true),
    expenses_to_pay_tax_category_id: findId('Expenses to Pay', 'tax_category'),
    expenses_in_advance_tax_category_id: findId('Expenses in Advance', 'tax_category'),
    income_to_collect_tax_category_id: findId('Income to Collect', 'tax_category'),
    income_in_advance_tax_category_id: findId('Income in Advance', 'tax_category'),
    zkufot_expenses_tax_category_id: findId('Zkufot Expenses', 'tax_category', true),
    zkufot_income_tax_category_id: findId('Zkufot Income', 'tax_category', true),
    social_security_expenses_tax_category_id: findId(
      'Social Security Expenses',
      'tax_category',
      true,
    ),
    salary_expenses_tax_category_id: findId('Salary Expenses', 'tax_category', true),
    training_fund_expenses_tax_category_id: findId('Training Fund', 'tax_category', true),
    pension_fund_expenses_tax_category_id: findId('Pension Expenses', 'tax_category', true),
    compensation_fund_expenses_tax_category_id: findId('Compensation Fund', 'tax_category', true),
    batched_employees_business_id: findId('Batched Employees', 'business', true),
    batched_funds_business_id: findId('Batched Funds', 'business', true),
    tax_deductions_business_id: findId('Tax Deductions', 'business', true),
    recovery_reserve_expenses_tax_category_id: findId(
      'Recovery Reserve Expenses',
      'tax_category',
      true,
    ),
    recovery_reserve_tax_category_id: findId('Recovery Reserve Tax', 'tax_category', true),
    vacation_reserve_expenses_tax_category_id: findId(
      'Vacation Reserve Expenses',
      'tax_category',
      true,
    ),
    vacation_reserve_tax_category_id: findId('Vacation Reserve Tax', 'tax_category', true),
    poalim_business_id: findId('Poalim', 'business', true),
    discount_business_id: findId('Discount', 'business', true),
    isracard_business_id: findId('Isracard', 'business', true),
    amex_business_id: findId('Amex', 'business', true),
    cal_business_id: findId('CAL', 'business', true),
    etana_business_id: findId('Etana', 'business', true),
    kraken_business_id: findId('Kraken', 'business', true),
    etherscan_business_id: findId('EtherScan', 'business', true),
    swift_business_id: findId('Swift', 'business', true),
    bank_deposit_business_id: findId('Bank Deposit', 'business', true),
    dividend_withholding_tax_business_id: findId('Dividends Withholding Tax', 'business', true),
    dividend_tax_category_id: findId('Dividend', 'tax_category', true),
    salary_excess_expenses_tax_category_id: findId('Salary Excess Expenses', 'tax_category'),
  };

  // insert user context
  try {
    await client.query(`
      INSERT INTO accounter_schema.user_context (owner_id, default_local_currency, default_fiat_currency_for_crypto_conversions,
      ${Object.keys(context).join(', ')})
      VALUES ('${adminEntityId}', 'ILS', 'USD', ${Object.values(context)
        .map(id => (id ? `'${id}'` : 'NULL'))
        .join(`, `)})
      RETURNING *;
      `);
  } catch (e) {
    console.error('Failed to create context:', e);
    throw new Error('Failed to create context');
  }
  console.log('✅ Admin business context created successfully');
}

// Run the seed function
seed().catch(error => {
  console.error('Failed to seed database:', error);
  process.exit(1);
});
