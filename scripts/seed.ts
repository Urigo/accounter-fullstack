import { config } from 'dotenv';
import pg from 'pg';

config();

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
      type: 'bank' | 'creditcard' | 'crypto';
      private_business: string;
      owner: string;
      bank_number?: number;
      branch_number?: number;
    }[] = [
      {
        account_number: 123_456,
        type: 'bank',
        private_business: 'business',
        owner: adminEntityId,
        bank_number: 12,
        branch_number: 123,
      },
      {
        account_number: 123_457,
        type: 'creditcard',
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
              ('Åland Islands', 'ALA');`);

      console.log(`✅ All countries have been successfully inserted`);
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
