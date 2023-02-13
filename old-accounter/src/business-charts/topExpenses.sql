 -- Not to include (create a function)
-- personal_category <> 'conversion'
-- financial_entity <> 'Isracard'
-- Taxes entities
-- financial_entity <> 'Tax'
-- financial_entity <> 'VAT'
-- financial_entity <> 'Tax Shuma'
-- financial_entity <> 'Tax Corona Grant'
-- Personal Salary - financial_entity <> 'Uri Goldshtein'
-- "Eshel" - financial_entity <> 'Uri Goldshtein Hoz'
-- Paycheck - financial_entity <> 'Uri Goldshtein Employee Social Security'
-- Paycheck - financial_entity <> 'Uri Goldshtein Employee Tax Withholding'
-- Dotan's parts - financial_entity <> 'Dotan Simha'
-- business_trip IS NULL
-- financial_entity <> 'Poalim' ?
-- with transactions_exclude as (
--     select *
--     from formatted_merged_tables
--     where
--         personal_category <> 'conversion' and
--         financial_entity <> 'Isracard' and
--         financial_entity <> 'Tax' and
--         financial_entity <> 'VAT' and
--         financial_entity <> 'Tax Shuma' and
--         financial_entity <> 'Tax Corona Grant' and
--         financial_entity <> 'Uri Goldshtein' and
--         financial_entity <> 'Uri Goldshtein Hoz' and
--         financial_entity <> 'Uri Goldshtein Employee Social Security' and
--         financial_entity <> 'Uri Goldshtein Employee Tax Withholding'
-- )
-- Business/Private accounts
--      account_number in (select account_number
--      from accounter_schema.financial_accounts accounts
--      where accounts.private_business = 'business')
-- Personal Categories
SELECT DISTINCT
  ON (personal_category) personal_category
FROM
  formatted_merged_tables;

-- all uncategorized transactions:
-- personal_category is null and full_supplier_name_outbound <> 'TOTAL FOR DATE' and full_supplier_name_outbound <> 'CASH ADVANCE FEE'
-- Wanted charts
-- Income (Overall, by year, by month, by financial entity -- GROUP BY financial_entity, by personal category -- GROUP BY personal_category, business/private)
-- Expenses (Overall, by year, by month, by financial entity, by personal category, business/private)
-- Profit (Overall, by year, by month, business/private)
-- Top income financial entity (by year, by month, private/business)
-- Top expense financial entity (by year, by month, private/business)
SELECT
  *
FROM
  top_expense_all_time;

CREATE OR REPLACE VIEW
  top_expense_all_time AS
SELECT
  ABS(
    SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2)
  ),
  financial_entity
FROM
  formatted_merged_tables
WHERE
  business_trip IS NULL
  AND (
    account_number = 2733
    OR account_number = 61066
  )
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Uri Goldshtein'
  AND financial_entity <> 'Tax'
  AND financial_entity <> 'VAT'
  AND financial_entity <> 'Dotan Simha'
  AND financial_entity <> 'Isracard'
  AND event_amount < 0
  AND event_date::TEXT::date >= '2020-01-01'::TEXT::date
  AND event_date::TEXT::date <= '2020-12-31'::TEXT::date --        OR event_date IS NULL
GROUP BY
  financial_entity
ORDER BY
  SUM(event_amount_in_usd_with_vat_if_exists)::NUMERIC(9, 2) NULLS LAST;

-- Business and private income, expense and overall by month or year
WITH
  transactions_exclude AS (
    SELECT
      *
    FROM
      formatted_merged_tables
    WHERE
      personal_category <> 'conversion'
      AND personal_category <> 'investments'
      AND financial_entity <> 'Isracard'
      AND financial_entity <> 'Tax'
      AND financial_entity <> 'VAT'
      AND financial_entity <> 'Tax Shuma'
      AND financial_entity <> 'Tax Corona Grant'
      AND financial_entity <> 'Uri Goldshtein'
      AND financial_entity <> 'Uri Goldshtein Hoz'
      AND financial_entity <> 'Uri Goldshtein Employee Social Security'
      AND financial_entity <> 'Uri Goldshtein Employee Tax Withholding'
      AND financial_entity <> 'Dotan Simha'
  ),
  business_accounts AS (
    SELECT
      account_number
    FROM
      accounter_schema.financial_accounts
    WHERE
      private_business = 'business'
  )
SELECT
  --  month
  --     to_char(event_date, 'YYYY/mm') as date,
  --  year
  TO_CHAR(event_date, 'YYYY') AS date,
  SUM(
    CASE
      WHEN (
        event_amount > 0
        AND personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd
      ELSE 0
    END
  )::float4 AS business_income,
  SUM(
    CASE
      WHEN (
        event_amount < 0
        AND personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd
      ELSE 0
    END
  )::float4 AS business_expenses,
  SUM(
    CASE
      WHEN (
        personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd
      ELSE 0
    END
  )::float4 AS overall_business_profit,
  SUM(
    CASE
      WHEN (
        personal_category = 'business'
        AND account_number IN (
          SELECT
            *
          FROM
            business_accounts
        )
      ) THEN event_amount_in_usd / 2
      ELSE 0
    END
  )::float4 AS business_profit_share --     sum(
  --         case when (event_amount < 0 and personal_category <> 'business') then event_amount_in_usd else 0 end
  --     )::float4 as private_expenses
  --     sum(case when personal_category <> 'business' then event_amount_in_usd else 0 end)::float4 as overall_private
FROM
  transactions_exclude -- where
  --     account_number in (select account_number
  --                        from accounter_schema.financial_accounts accounts
  --                        where accounts.private_business = 'business')
  -- where
  --     event_date::text::date >= '2019-01-01'::text::date
GROUP BY
  date
ORDER BY
  date;

-- Expenses (Overall, by year, by month, by personal category, private)
WITH
  transactions_exclude AS (
    SELECT
      *
    FROM
      formatted_merged_tables
    WHERE
      personal_category <> 'conversion'
      AND personal_category <> 'investments'
      AND financial_entity <> 'Isracard'
      AND financial_entity <> 'Tax'
      AND financial_entity <> 'VAT'
      AND financial_entity <> 'Tax Shuma'
      AND financial_entity <> 'Tax Corona Grant'
      AND financial_entity <> 'Uri Goldshtein'
      AND financial_entity <> 'Uri Goldshtein Hoz'
      AND financial_entity <> 'Uri Goldshtein Employee Social Security'
      AND financial_entity <> 'Uri Goldshtein Employee Tax Withholding'
      AND financial_entity <> 'Dotan Simha'
      AND personal_category <> 'business'
  )
SELECT
  personal_category,
  SUM(event_amount_in_usd)::float4 AS overall_sum
FROM
  transactions_exclude
WHERE
  event_date::TEXT::date >= '2021-01-01'::TEXT::date
  AND event_date::TEXT::date <= '2021-01-31'::TEXT::date --   and personal_category = 'family'
GROUP BY
  personal_category
ORDER BY
  SUM(event_amount_in_usd);

-- Top Expenses
WITH
  transactions_exclude AS (
    SELECT
      *
    FROM
      formatted_merged_tables
    WHERE
      personal_category <> 'conversion'
      AND personal_category <> 'investments'
      AND financial_entity <> 'Isracard'
      AND financial_entity <> 'Tax'
      AND financial_entity <> 'VAT'
      AND financial_entity <> 'Tax Shuma'
      AND financial_entity <> 'Tax Corona Grant'
      AND financial_entity <> 'Uri Goldshtein'
      AND financial_entity <> 'Uri Goldshtein Hoz'
      AND financial_entity <> 'Uri Goldshtein Employee Social Security'
      AND financial_entity <> 'Uri Goldshtein Employee Tax Withholding'
      AND financial_entity <> 'Dotan Simha'
      AND personal_category <> 'business'
  )
SELECT
  event_date,
  event_amount_in_usd,
  financial_entity,
  user_description,
  personal_category
FROM
  transactions_exclude
WHERE
  event_date::TEXT::date >= '2020-12-01'::TEXT::date
  AND event_date::TEXT::date <= '2020-12-31'::TEXT::date
ORDER BY
  event_amount_in_usd;

SELECT
  SUM(
    formatted_invoice_amount_in_ils_with_vat_if_exists::float4
  )::float4 AS invoice_sum,
  SUM(
    formatted_event_amount_in_ils_with_vat_if_exist::float4
  )::float4 AS event_sum
FROM
  formatted_merged_tables
WHERE
  account_number = 466803
  AND event_amount > 0
  AND event_date::TEXT::date >= '2020-12-01'::TEXT::date
  AND event_date::TEXT::date <= '2020-12-31'::TEXT::date
