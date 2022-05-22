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
select distinct on (personal_category)
    personal_category
from formatted_merged_tables;

-- all uncategorized transactions:
-- personal_category is null and full_supplier_name_outbound <> 'TOTAL FOR DATE' and full_supplier_name_outbound <> 'CASH ADVANCE FEE'

-- Wanted charts
-- Income (Overall, by year, by month, by financial entity -- GROUP BY financial_entity, by personal category -- GROUP BY personal_category, business/private)
-- Expenses (Overall, by year, by month, by financial entity, by personal category, business/private)
-- Profit (Overall, by year, by month, business/private)
-- Top income financial entity (by year, by month, private/business)
-- Top expense financial entity (by year, by month, private/business)

select * from top_expense_all_time;

CREATE OR REPLACE VIEW top_expense_all_time AS
SELECT ABS(SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2)),
       financial_entity
FROM formatted_merged_tables
WHERE business_trip IS NULL
  AND (account_number = 2733 OR account_number = 61066)
  AND personal_category <> 'conversion'
  AND financial_entity <> 'Uri Goldshtein'
  AND financial_entity <> 'Tax'
  AND financial_entity <> 'VAT'
  AND financial_entity <> 'Dotan Simha'
  AND financial_entity <> 'Isracard'
  AND event_amount < 0
  AND event_date::text::date >= '2020-01-01'::text::date
  AND event_date::text::date <= '2020-12-31'::text::date
  --        OR event_date IS NULL
GROUP BY financial_entity
ORDER BY SUM(event_amount_in_usd_with_vat_if_exists)::numeric(9, 2) NULLS LAST;



-- Business and private income, expense and overall by month or year
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
        financial_entity <> 'Uri Goldshtein Employee Social Security' and
        financial_entity <> 'Uri Goldshtein Employee Tax Withholding' and
        financial_entity <> 'Dotan Simha'
), business_accounts as (
    select account_number
    from accounter_schema.financial_accounts
    where private_business = 'business'
)
select
--  month
--     to_char(event_date, 'YYYY/mm') as date,
--  year
 to_char(event_date, 'YYYY') as date,
    sum(
        case when (event_amount > 0 and personal_category = 'business' and account_number in (select * from business_accounts)) then event_amount_in_usd else 0 end
    )::float4 as business_income,
    sum(
        case when (event_amount < 0 and personal_category = 'business' and account_number in (select * from business_accounts)) then event_amount_in_usd else 0 end
    )::float4 as business_expenses,
    sum(case when (personal_category = 'business' and account_number in (select * from business_accounts)) then event_amount_in_usd else 0 end)::float4 as overall_business_profit,
    sum(case when (personal_category = 'business' and account_number in (select * from business_accounts)) then event_amount_in_usd/2 else 0 end)::float4 as business_profit_share

--     sum(
--         case when (event_amount < 0 and personal_category <> 'business') then event_amount_in_usd else 0 end
--     )::float4 as private_expenses
--     sum(case when personal_category <> 'business' then event_amount_in_usd else 0 end)::float4 as overall_private
from transactions_exclude
-- where
--     account_number in (select account_number
--                        from accounter_schema.financial_accounts accounts
--                        where accounts.private_business = 'business')
-- where
--     event_date::text::date >= '2019-01-01'::text::date
group by date
order by date;








-- Expenses (Overall, by year, by month, by personal category, private)
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
        financial_entity <> 'Uri Goldshtein Employee Social Security' and
        financial_entity <> 'Uri Goldshtein Employee Tax Withholding' and
        financial_entity <> 'Dotan Simha' and
        personal_category <> 'business'
)
select
    personal_category,
    sum(event_amount_in_usd)::float4 as overall_sum
from transactions_exclude
where
  event_date::text::date >= '2021-01-01'::text::date and
  event_date::text::date <= '2021-01-31'::text::date
--   and personal_category = 'family'
group by personal_category
order by sum(event_amount_in_usd);




-- Top Expenses
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
        financial_entity <> 'Uri Goldshtein Employee Social Security' and
        financial_entity <> 'Uri Goldshtein Employee Tax Withholding' and
        financial_entity <> 'Dotan Simha' and
        personal_category <> 'business'
)
select
    event_date,
    event_amount_in_usd,
    financial_entity,
    user_description,
    personal_category
from transactions_exclude
where
  event_date::text::date >= '2020-12-01'::text::date and
  event_date::text::date <= '2020-12-31'::text::date
order by event_amount_in_usd;


select
       sum(formatted_invoice_amount_in_ils_with_vat_if_exists::float4)::float4 as invoice_sum,
       sum(formatted_event_amount_in_ils_with_vat_if_exist::float4)::float4 as event_sum
from formatted_merged_tables
where account_number = 466803
and event_amount > 0
and   event_date::text::date >= '2020-12-01'::text::date and
  event_date::text::date <= '2020-12-31'::text::date