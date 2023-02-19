import { config } from 'dotenv';
import express, { Express, Request, Response } from 'express';
import { Pool } from 'pg';
import { generateTaxMovement } from './generate-tax-movement';

config({ path: '../.env' });

const app: Express = express();
const port = 4001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers');
  next();
});

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.get('/getLastInvoiceNumbers', async (_req: Request, res: Response) => {
  console.log('getLastInvoiceNumbers request');

  const queryRes = await pool.query(`
    SELECT at.tax_invoice_number,
      at.user_description,
      b.name as financial_entity_name,
      at.event_amount,
      at.event_date
    FROM accounter_schema.all_transactions at
    LEFT JOIN accounter_schema.businesses b
    ON at.financial_entity_id = b.id
    WHERE
      (account_number in ('466803', '1074', '1082', '5972')) AND
      event_amount > 0 AND
      (financial_entity_id not in (
        -- Poalim
        '8fa16264-de32-4592-bffb-64a1914318ad',
        -- VAT
        'c7fdf6f6-e075-44ee-b251-cbefea366826'
      ) OR financial_entity_id IS NULL)
    ORDER BY event_date DESC;`);
  res.send(queryRes.rows);
});

app.post('/getMissingInvoiceDates', async (req: Request, res: Response) => {
  console.log('getMissingInvoiceDates request');

  const monthTaxReport = req.body?.monthTaxReport;

  // TODO: add format validation
  if (!monthTaxReport) {
    throw new Error('monthTaxReport is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from missing_invoice_dates($1)
      order by event_date;
    `,
    [`$$${monthTaxReport}$$`],
  );
  res.send(queryRes.rows);
});

app.post('/getMissingInvoiceImages', async (req: Request, res: Response) => {
  console.log('getMissingInvoiceImages request');

  const monthTaxReport = req.body?.monthTaxReport;

  // TODO: add format validation
  if (!monthTaxReport) {
    throw new Error('monthTaxReport is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from missing_invoice_images($1)
      order by event_date;
    `,
    [`$$${monthTaxReport}$$`],
  );

  res.send(queryRes.rows);
});

app.post('/getMissingInvoiceNumbers', async (req: Request, res: Response) => {
  console.log('getMissingInvoiceNumbers request');

  const monthTaxReport = req.body?.monthTaxReport;

  // TODO: add format validation
  if (!monthTaxReport) {
    throw new Error('monthTaxReport is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from missing_invoice_numbers($1)
      order by event_date;
    `,
    [`$$${monthTaxReport}$$`],
  );

  res.send(queryRes.rows);
});

app.get('/getProfitTable', async (req: Request, res: Response) => {
  console.log('getProfitTable request');

  const queryRes = await pool.query(`
  with all_exchange_dates as (
      select dt AS     exchange_date,
            (select t1.eur
              from accounter_schema.exchange_rates t1
              where date_trunc('day', t1.exchange_date)::date <= times_table.dt
              order by t1.exchange_date desc
              limit 1) eur_rate,
            (select t1.usd
              from accounter_schema.exchange_rates t1
              where date_trunc('day', t1.exchange_date)::date <= times_table.dt
              order by t1.exchange_date desc
              limit 1) usd_rate,
            (select t1.gbp
              from accounter_schema.exchange_rates t1
              where date_trunc('day', t1.exchange_date)::date <= times_table.dt
              order by t1.exchange_date desc
              limit 1) gbp_rate            
      from times_table
      order by dt
  ), formatted_merged_tables as (
          SELECT *,
                  (CASE
                      WHEN currency_code = 'ILS' THEN (event_amount - COALESCE(vat, 0)) / (
                          select all_exchange_dates.usd_rate
                          from all_exchange_dates
                          where all_exchange_dates.exchange_date <= debit_date::text::date
                          order by all_exchange_dates.exchange_date desc
                          limit 1
                      )
                      WHEN currency_code = 'EUR' THEN (event_amount - COALESCE(vat, 0)) * (
                              (
                                  select all_exchange_dates.eur_rate
                                  from all_exchange_dates
                                  where all_exchange_dates.exchange_date <= debit_date::text::date
                                  order by all_exchange_dates.exchange_date desc
                                  limit 1
                              ) / (
                                  select all_exchange_dates.usd_rate
                                  from all_exchange_dates
                                  where all_exchange_dates.exchange_date <= debit_date::text::date
                                  order by all_exchange_dates.exchange_date desc
                                  limit 1
                              )
                          )
                      WHEN currency_code = 'GBP' THEN (event_amount - COALESCE(vat, 0)) * (
                              (
                                  select all_exchange_dates.gbp_rate
                                  from all_exchange_dates
                                  where all_exchange_dates.exchange_date <= debit_date::text::date
                                  order by all_exchange_dates.exchange_date desc
                                  limit 1
                              ) / (
                                  select all_exchange_dates.usd_rate
                                  from all_exchange_dates
                                  where all_exchange_dates.exchange_date <= debit_date::text::date
                                  order by all_exchange_dates.exchange_date desc
                                  limit 1
                              )
                          )                         
                      WHEN currency_code = 'USD' THEN event_amount - COALESCE(vat, 0)
                      ELSE -99999999999
                      END
                      ) as event_amount_in_usd_with_vat_if_exists
          FROM accounter_schema.all_transactions
      ),
  transactions_exclude as (
      select *
      from formatted_merged_tables
        where 
          personal_category <> 'conversion'
          and personal_category <> 'investments'
          and financial_entity_id NOT IN (
            '96dba127-90f4-4407-ae89-5a53afa42ca3', -- Isracard
            '9d3a8a88-6958-4119-b509-d50a7cdc0744', -- Tax
            'c7fdf6f6-e075-44ee-b251-cbefea366826', -- VAT
          ) 
          and financial_entity <> 'Tax Shuma'
          and financial_entity <> 'Tax Corona Grant'
          and financial_entity <> 'Uri Goldshtein'
          and financial_entity <> 'Uri Goldshtein Hoz'
          and financial_entity <> 'Social Security Deductions'
          and financial_entity <> 'Tax Deductions'
          and financial_entity <> 'Dotan Simha'
  ),
  business_accounts as (
      select account_number
      from accounter_schema.financial_accounts
      where private_business = 'business'
      -- where owner = '6a20aa69-57ff-446e-8d6a-1e96d095e988'
  )
  select
      --  month
      to_char(event_date, 'YYYY/mm') as date,
      --  year
      -- to_char(event_date, 'YYYY') as date,
      sum(
              case
                  when (event_amount > 0 and personal_category = 'business' and
                        account_number in (select * from business_accounts)) then event_amount_in_usd_with_vat_if_exists
                  else 0 end
          )::float4                  as business_income,
      sum(
              case
                  when (event_amount < 0 and personal_category = 'business' and
                        account_number in (select * from business_accounts)) then event_amount_in_usd_with_vat_if_exists
                  else 0 end
          )::float4                  as business_expenses,
      sum(case
              when (personal_category = 'business' and account_number in (select * from business_accounts))
                  then event_amount_in_usd_with_vat_if_exists
              else 0 end)::float4    as overall_business_profit,
      sum(case
              when (personal_category = 'business' and account_number in (select * from business_accounts))
                  then event_amount_in_usd_with_vat_if_exists / 2
              else 0 end)::float4    as business_profit_share,

      sum(
              case
                  when (event_amount < 0 and personal_category <> 'business') then event_amount_in_usd_with_vat_if_exists
                  else 0 end
          )::float4                  as private_expenses,
      sum(case
              when personal_category <> 'business' then event_amount_in_usd_with_vat_if_exists
              else 0 end)::float4    as overall_private
  from transactions_exclude
      -- where
      --     account_number in (select account_number
      --                        from accounter_schema.financial_accounts accounts
      --                        where accounts.private_business = 'business')
  where event_date::text::date >= '2020-10-01'::text::date
  group by date
  order by date;`);
  res.send(queryRes.rows);
});

app.get('/getThisMonthPrivateExpenses', async (req: Request, res: Response) => {
  console.log('getThisMonthPrivateExpenses request');

  const queryRes = await pool.query(`
  with transactions_exclude as (
    select *
    from formatted_merged_tables
    where
        personal_category <> 'conversion' and
        personal_category <> 'investments' and
        financial_entity <> 'Isracard' and
        financial_entity <> 'Tax' and
        financial_entity <> 'VAT' and
        financial_entity <> 'Tax Shuma' and
        financial_entity <> 'Tax Corona Grant' and
        financial_entity <> 'Uri Goldshtein' and
        financial_entity <> 'Uri Goldshtein Hoz' and
        financial_entity <> 'Social Security Deductions' and
        financial_entity <> 'Tax Deductions' and
        financial_entity <> 'Dotan Simha' and
        personal_category <> 'business'
  )
  select
    personal_category,
    sum(event_amount_in_usd_with_vat_if_exists)::float4 as overall_sum
  from transactions_exclude
  where
  event_date::text::date >= '2021-08-01'::text::date and
  event_date::text::date <= '2021-08-31'::text::date
  --   and personal_category = 'family'
  group by personal_category
  order by sum(event_amount_in_usd_with_vat_if_exists);`);
  res.send(queryRes.rows);
});

app.post('/getVatTransactions', async (req: Request, res: Response) => {
  console.log('getVatTransactions request');

  const monthTaxReport = req.body?.monthTaxReport;

  // TODO: add format validation
  if (!monthTaxReport) {
    throw new Error('monthTaxReport is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from get_vat_for_month($1);
    `,
    [`$$${monthTaxReport}$$`],
  );

  res.send(queryRes.rows);
});

app.post('/getAllTransactions', async (req: Request, res: Response) => {
  console.log('getAllTransactions request');

  const financialEntity = req.body?.financialEntity;
  let accountsToFetch = '';
  if (financialEntity == 'Guild') {
    accountsToFetch = `where account_number in ('466803', '1074', '1082', '5972')`;
  } else if (financialEntity == 'UriLTD') {
    accountsToFetch = `where account_number in ('61066', '2733')`;
  } else if (financialEntity == 'Uri') {
    accountsToFetch = `where account_number in ('410915', '6264')`;
  }
  const queryRes = await pool.query(`
    select *
    from accounter_schema.all_transactions
    ${accountsToFetch}
    order by event_date desc
    limit 2550;
  `);
  res.send(queryRes.rows);
});

app.post('/getMonthlyTaxesReport', async (req: Request, res: Response) => {
  console.log('getMonthlyTaxesReport request');

  const monthTaxReport = req.body?.monthTaxReport;

  // TODO: add format validation
  if (!monthTaxReport) {
    throw new Error('monthTaxReport is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from get_tax_report_of_month($1);
    `,
    [`$$${monthTaxReport}$$`],
  );

  res.send(queryRes.rows);
});

app.post('/getTopPrivateNotCategorized', async (req: Request, res: Response) => {
  console.log('getTopPrivateNotCategorized request');

  const startingDate = req.body?.startingDate;

  // TODO: add format validation
  if (!startingDate) {
    throw new Error('startingDate is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from top_expenses_not_categorized($1);
    `,
    [`$$${startingDate}$$`],
  );

  res.send(queryRes.rows);
});

app.post('/updateBankTransactionAttribute', async (req: Request, res: Response) => {
  console.log('updateBankTransactionAttribute request');

  const { transactionId, attribute, value } = req.body;

  // TODO: add format validation
  if (!transactionId) {
    throw new Error('transactionId is missing');
  }
  if (!attribute) {
    throw new Error('attribute is missing');
  }
  if (!value) {
    throw new Error('value is missing');
  }

  const queryRes = await pool.query(
    `
        update accounter_schema.ledger
        set ${attribute} = $1
        where id = $2;
      `,
    [value, transactionId],
  );

  res.send(queryRes.rows);
});

app.post('/editTransaction', async (req: Request, res: Response) => {
  const { id, propertyToChange, newValue } = req.body;

  console.log(`editTransaction request ${id} ${propertyToChange} ${newValue}`);
  // TODO: add format validation
  if (!id) {
    throw new Error('id is missing');
  }
  if (!propertyToChange) {
    throw new Error('propertyToChange is missing');
  }
  if (!newValue) {
    throw new Error('newValue is missing');
  }

  const queryRes = await pool.query(
    `
      UPDATE accounter_schema.all_transactions
      SET ${propertyToChange} = $1
      WHERE id = $2
      RETURNING ${propertyToChange};
    `,
    [newValue, id],
  );

  res.send(queryRes.rows);
});

app.post('/deleteTaxMovement', async (req: Request, res: Response) => {
  console.log('deleteTaxMovement request');

  const transactionId = req.body?.transactionId;

  // TODO: add format validation
  if (!transactionId) {
    throw new Error('transactionId is missing');
  }

  const queryRes = await pool.query(
    `
    delete from accounter_schema.ledger
    where id = $1
    returning *;
    `,
    [`$$${transactionId}$$`],
  );

  res.send(queryRes.rows);
});

app.post('/reviewTransaction', async (req: Request, res: Response) => {
  console.log('reviewTransaction request');

  const { id, reviewed, accountType } = req.body;
  const tableToUpdate = accountType ? 'all_transactions' : 'ledger';

  // TODO: add format validation
  if (!id) {
    throw new Error('id is missing');
  }
  if (!reviewed) {
    throw new Error('reviewed is missing');
  }

  const queryRes = await pool.query(
    `
      UPDATE accounter_schema.${tableToUpdate}
      SET reviewed = $1
      WHERE id = $2
      RETURNING *;
    `,
    [`$$${reviewed}$$`, `$$${id}$$`],
  );

  res.send(queryRes.rows);
});

app.post('/getAllUsers', async (req: Request, res: Response) => {
  console.log('getAllUsers request');

  const currrentCompany = req.body?.currrentCompany;

  const query =
    ['debit_account_1', 'debit_account_2', 'credit_account_1', 'credit_account_2']
      .map(
        column =>
          `select ${column} as userName from accounter_schema.ledger${
            currrentCompany ? ` where business = '${currrentCompany}'` : ''
          }`,
      )
      .join(' union ') + ' order by userName';

  const queryRes = await pool.query(query);

  res.send(queryRes.rows);
});

app.post('/getUserTransactions', async (req: Request, res: Response) => {
  console.log('getUserTransactions request');

  const { userName, companyId } = req.body;

  // TODO: add format validation
  if (!userName) {
    throw new Error('userName is missing');
  }
  if (!companyId) {
    throw new Error('companyId is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from accounter_schema.ledger
      where business = '${companyId}' and $1 in (debit_account_1, debit_account_2, credit_account_1, credit_account_2)
      order by to_date(date_3, 'DD/MM/YYYY') asc, original_id, details, debit_account_1, id;
    `,
    [`$$${userName}$$`],
  );

  res.send(queryRes.rows);
});

app.post('/generateTaxMovement', async (req: Request, res: Response) => {
  console.log('generateTaxMovement request');

  const transactionId = req.body?.transactionId;

  // TODO: add format validation
  if (!transactionId) {
    throw new Error('transactionId is missing');
  }

  const result = await generateTaxMovement(transactionId);
  res.send(result);
});

app.post('/getReportToReview', async (req: Request, res: Response) => {
  console.log('getReportToReview request');

  const { company, reportMonthToReview } = req.body;

  // TODO: add format validation
  if (!company) {
    throw new Error('company is missing');
  }
  if (!reportMonthToReview) {
    throw new Error('reportMonthToReview is missing');
  }

  const queryRes = await pool.query(
    `
      select *
      from get_unified_tax_report_of_month($1, '2020-01-01', $2)
      order by to_date(date_3, 'DD/MM/YYYY') desc, original_id, details, debit_account_1, id;
    `,
    [`$$${company}$$`, `$$${reportMonthToReview}$$`],
  );

  res.send(queryRes.rows);
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
