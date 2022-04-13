import express, { Express, Request, Response } from 'express';
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const app: Express = express();
const port = 4001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Access-Control-Allow-Headers'
  );
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
    SELECT tax_invoice_number,
      user_description,
      financial_entity,
      event_amount,
      event_date
    FROM accounter_schema.all_transactions
    WHERE
      (account_number in ('466803', '1074', '1082')) AND
      event_amount > 0 AND
      (financial_entity not in ('Poalim', 'VAT') OR financial_entity IS NULL)
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
    [`$$${monthTaxReport}$$`]
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
    [`$$${monthTaxReport}$$`]
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
    [`$$${monthTaxReport}$$`]
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
          and financial_entity <> 'Isracard'
          and financial_entity <> 'Tax'
          and financial_entity <> 'VAT'
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
    [`$$${monthTaxReport}$$`]
  );

  res.send(queryRes.rows);
});

app.get('/getAllTransactions', async (req: Request, res: Response) => {
  console.log('getAllTransactions request');

  const queryRes = await pool.query(`
    select *
    from accounter_schema.all_transactions
    -- where account_number in ('466803', '1074', '1082')
    order by event_date desc
    limit 2550;
  `);
  res.send(queryRes.rows);
});

app.get('/getMonthlyTaxesReport', async (req: Request, res: Response) => {
  console.log('getMonthlyTaxesReport request');
  res.send('getMonthlyTaxesReport');
});

app.get('/getTopPrivateNotCategorized', async (req: Request, res: Response) => {
  console.log('getTopPrivateNotCategorized request');
  res.send('getTopPrivateNotCategorized');
});

app.get(
  '/updateBankTransactionAttribute',
  async (req: Request, res: Response) => {
    console.log('updateBankTransactionAttribute request');
    res.send('updateBankTransactionAttribute');
  }
);

app.get('/editTransaction', async (req: Request, res: Response) => {
  console.log('editTransaction request');
  res.send('editTransaction');
});

app.get('/deleteTaxMovement', async (req: Request, res: Response) => {
  console.log('deleteTaxMovement request');
  res.send('deleteTaxMovement');
});

app.get('/reviewTransaction', async (req: Request, res: Response) => {
  console.log('reviewTransaction request');
  res.send('reviewTransaction');
});

app.get('/getAllUsers', async (req: Request, res: Response) => {
  console.log('getAllUsers request');
  res.send('getAllUsers');
});

app.get('/getUserTransactions', async (req: Request, res: Response) => {
  console.log('getUserTransactions request');
  res.send('getUserTransactions');
});

app.get('/generateTaxMovement', async (req: Request, res: Response) => {
  console.log('generateTaxMovement request');
  res.send('generateTaxMovement');
});

app.get('/getReportToReview', async (req: Request, res: Response) => {
  console.log('getReportToReview request');
  res.send('getReportToReview');
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
