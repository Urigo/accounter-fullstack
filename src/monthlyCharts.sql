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
            limit 1) usd_rate
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
                     WHEN currency_code = 'USD' THEN event_amount - COALESCE(vat, 0)
                     ELSE -99999999999
                    END
                    ) as event_amount_in_usd_with_vat_if_exists
         FROM accounter_schema.all_transactions
     ),
 transactions_exclude as (
     select *
     from formatted_merged_tables
     where personal_category <> 'conversion'
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
 )
select
    --  month
    to_char(event_date, 'YYYY/mm') as date,
    --  year
    --  to_char(event_date, 'YYYY') as date,
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
order by date;