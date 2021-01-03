insert into accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
select * from get_tax_report_of_transaction('7e81e7c7-6fce-4e6f-8a9f-cccec8185ade')
returning *;


select *
into table accounter_schema.saved_tax_reports_2020_03_04_05_06_07_08_09
from get_tax_report_of_transaction('21b53e78-ef11-4edc-8a68-1e2357d90ca8')
order by to_date(תאריך_3, 'DD/MM/YYYY'), original_id;

drop function get_tax_report_of_transaction(transaction_id uuid);

create or replace function get_tax_report_of_transaction(transaction_id uuid)
returns table(
       תאריך_חשבונית varchar,
       חשבון_חובה_1 varchar,
       סכום_חובה_1 varchar,
       מטח_סכום_חובה_1 varchar,
       מטבע varchar,
       חשבון_זכות_1 varchar,
       סכום_זכות_1 varchar,
       מטח_סכום_זכות_1 varchar,
       חשבון_חובה_2 varchar,
       סכום_חובה_2 varchar,
       מטח_סכום_חובה_2 varchar,
       חשבון_זכות_2 varchar,
       סכום_זכות_2 varchar,
       מטח_סכום_זכות_2 varchar,
       פרטים varchar,
       אסמכתא_1 bigint,
       אסמכתא_2 varchar,
       סוג_תנועה varchar,
       תאריך_ערך varchar,
       תאריך_3 varchar,
       original_id uuid,
       origin text,
       proforma_invoice_file text
)
LANGUAGE SQL
AS $$



WITH this_month_business AS (
SELECT *
FROM formatted_merged_tables
WHERE
    id = transaction_id
), full_report_selection as (
    SELECT
        (CASE
            WHEN side = 0 THEN
                (CASE
                    WHEN (financial_entity = 'Poalim' OR financial_entity = 'Isracard')
                        THEN formatted_event_date
                    ELSE formatted_tax_invoice_date
                END)
            ELSE
                formatted_event_date
        END) AS תאריך_חשבונית,
        (CASE WHEN event_amount < 0 THEN
            (CASE WHEN side = 0 THEN
                formatted_tax_category
                ELSE formatted_financial_entity
            END) ELSE
            (CASE WHEN side = 0 THEN
                formatted_financial_entity
                ELSE formatted_account
            END)
        END) AS חשבון_חובה_1,
        (CASE WHEN event_amount < 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS סכום_חובה_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS מטח_סכום_חובה_1,
        formatted_currency AS מטבע,
        (CASE WHEN event_amount < 0 THEN
           (CASE
              WHEN side = 0 THEN formatted_financial_entity
              ELSE formatted_account
           END) ELSE
           (CASE
               WHEN side = 0 THEN formatted_tax_category
               ELSE formatted_financial_entity
           END)
        END) AS חשבון_זכות_1,
        (CASE WHEN event_amount > 0 THEN
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_if_exists
                ELSE formatted_event_amount_in_ils_with_interest
            END) ELSE
            (CASE
                WHEN side = 0 THEN formatted_invoice_amount_in_ils_with_vat_if_exists
                ELSE formatted_event_amount_in_ils
            END)
        END) AS סכום_זכות_1,
        (CASE
            WHEN side = 0 THEN formatted_invoice_foreign_amount_if_exist
            ELSE formatted_foreign_amount_if_exist
        END) AS מטח_סכום_זכות_1,
        (CASE
            WHEN (side = 0 AND event_amount < 0 AND vat <> 0) THEN 'תשו'
            when (side = 1 and event_amount < 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS חשבון_חובה_2,
        (case
            when currency_code = 'ILS' then
                 (CASE
                    WHEN (side = 0 AND event_amount < 0) THEN (CASE WHEN vat <> 0 THEN to_char(float8 (ABS(
                        (case
                            when tax_category = 'פלאפון' then ((vat::float/3)*2)
                            when tax_category = 'מידע' then ((vat::float/3)*2)
                        else vat
                        end)
                        )), 'FM999999999.00') END)
                    when (side = 1 and event_amount < 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
            else
                (CASE
                    WHEN (side = 0 AND event_amount < 0) THEN
                        (CASE WHEN vat <> 0 THEN
                            to_char(float8 (ABS(formatted_usd_vat_in_ils)), 'FM999999999.00')
                        END)
                    when (side = 1 and event_amount < 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
        end) AS סכום_חובה_2,
        to_char(float8 (formatted_foreign_vat), 'FM999999999.00') AS מטח_סכום_חובה_2,
        (CASE
            WHEN (side = 0 AND event_amount > 0 AND vat <> 0) THEN 'עסק'
            when (side = 1 and event_amount > 0 and interest <> 0) THEN 'הכנרבמ'
--             ELSE NULL
            END
        ) AS חשבון_זכות_2,
        (case
            when currency_code = 'ILS' then
                (CASE
                    WHEN (side = 0 AND event_amount > 0) THEN (CASE WHEN vat <> 0 THEN to_char(float8 (ABS(vat)), 'FM999999999.00') END)
                    when (side = 1 and event_amount > 0 and interest <> 0)
                        then to_char(float8 (ABS(interest)), 'FM999999999.00')
        --             ELSE NULL
                 END)
            else
                (CASE
                    WHEN (side = 0 AND event_amount > 0) THEN
                        (CASE WHEN vat <> 0 THEN
                            to_char(float8 (ABS(formatted_usd_vat_in_ils)), 'FM999999999.00')
                        END)
                    when (side = 1 and event_amount > 0 and interest <> 0)
                        then to_char(float8 (ABS(interest) ), 'FM999999999.00')
        --             ELSE NULL
                 END)
        end) AS סכום_זכות_2,
        to_char(float8 (formatted_foreign_vat), 'FM999999999.00') AS מטח_סכום_זכות_2,
        user_description AS פרטים,
        bank_reference AS אסמכתא_1,
        RIGHT(regexp_replace(tax_invoice_number, '[^0-9]+', '', 'g'), 9) AS אסמכתא_2,
        (CASE
            WHEN side = 0 THEN
                (CASE WHEN event_amount < 0 THEN
                    (CASE
                        WHEN currency_code = 'ILS' THEN
                            (CASE
                                WHEN financial_entity = 'Hot Mobile' THEN 'פלא'
                                WHEN vat <> 0 THEN 'חס'
                                ELSE NULL
                            END)
                        ELSE ''
                    END)
                ELSE
                    (CASE
                        WHEN vat <> 0 THEN 'חל'
                        ELSE 'הכפ'
                    END)
                END)
--             ELSE NULL
            END
        ) AS סוג_תנועה,
       (case
           when (tax_invoice_date is not null and account_type != 'creditcard' and side = 0) then formatted_tax_invoice_date
           else (CASE
                    WHEN debit_date IS NULL THEN formatted_event_date
                    ELSE formatted_debit_date
                END)
       end) as תאריך_ערך,
        formatted_event_date AS תאריך_3,
        formatted_invoice_amount_in_ils_if_exists,
        formatted_event_amount_in_ils,
        formatted_financial_entity,
        event_amount,
        account_type,
        vat,
        tax_invoice_date,
        financial_entity,
        side,
        is_conversion,
        tax_invoice_amount,
        currency_rate,
        personal_category,
        currency_code,
        contra_currency_code,
        debit_date,
        proforma_invoice_file,
        id,
        formatted_tax_category
    FROM this_month_business, generate_series(0,1) as side /* 0 = Entities, 1 = Accounts */
), two_sides as (
    SELECT
        תאריך_חשבונית,
        חשבון_חובה_1,
        סכום_חובה_1,
        מטח_סכום_חובה_1,
        מטבע,
        חשבון_זכות_1,
        סכום_זכות_1,
        מטח_סכום_זכות_1,
        חשבון_חובה_2,
        סכום_חובה_2,
        מטח_סכום_חובה_2,
        חשבון_זכות_2,
        סכום_זכות_2,
        מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        אסמכתא_2,
        סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
        id as original_id,
        concat('two_sides - ', side) as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
        financial_entity != 'Isracard' AND
        financial_entity != 'Tax' AND
        financial_entity != 'VAT' AND
        financial_entity != 'Uri Goldshtein Employee Tax Withholding' AND
        financial_entity != 'Uri Goldshtein' AND
        financial_entity != 'Uri Goldshtein Employee Social Security' AND
        financial_entity != 'Tax Corona Grant' AND
        financial_entity != 'Uri Goldshtein Hoz' AND
        formatted_tax_category != 'אוריח' AND
        financial_entity != 'VAT interest refund' AND
        financial_entity != 'Tax Shuma' AND
        is_conversion <> TRUE
), one_side as (
    SELECT
        תאריך_חשבונית,
        חשבון_חובה_1,
        סכום_חובה_1,
        מטח_סכום_חובה_1,
        מטבע,
        חשבון_זכות_1,
        סכום_זכות_1,
        מטח_סכום_זכות_1,
        חשבון_חובה_2,
        סכום_חובה_2,
        מטח_סכום_חובה_2,
        חשבון_זכות_2,
        סכום_זכות_2,
        מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        אסמכתא_2,
        סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
        id as original_id,
        concat('one_side - ', side) as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
       (financial_entity = 'Uri Goldshtein' OR
        financial_entity = 'Tax' OR
        financial_entity = 'VAT' OR
        financial_entity = 'Uri Goldshtein Employee Social Security' OR
        financial_entity = 'Isracard' OR
        financial_entity = 'Uri Goldshtein Employee Tax Withholding' OR
        financial_entity = 'Tax Corona Grant' OR
        financial_entity = 'Uri Goldshtein Hoz' or
        formatted_tax_category = 'אוריח' or
        financial_entity = 'VAT interest refund' or
        financial_entity = 'Tax Shuma') AND
       side = 1
), conversions as (
    SELECT
        תאריך_חשבונית,
        (CASE WHEN event_amount > 0 THEN חשבון_חובה_1 END) as חשבון_חובה_1,
        (CASE WHEN event_amount > 0 THEN סכום_חובה_1 END) as סכום_חובה_1,
        (CASE WHEN event_amount > 0 THEN מטח_סכום_חובה_1 END) as מטח_סכום_חובה_1,
        מטבע,
        (CASE WHEN event_amount < 0 THEN חשבון_זכות_1 END) as חשבון_זכות_1,
        (CASE WHEN event_amount < 0 THEN סכום_זכות_1 END) as סכום_זכות_1,
        (CASE WHEN event_amount < 0 THEN מטח_סכום_זכות_1 END) as מטח_זכות_חובה_1,
        '' AS חשבון_חובה_2,
        '' AS סכום_חובה_2,
        '' AS מטח_סכום_חובה_2,
        '' AS חשבון_זכות_2,
        '' AS סכום_זכות_2,
        '' AS מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        '' AS אסמכתא_2,
        '' AS סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
        id as original_id,
        'conversions' as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
         is_conversion IS TRUE AND
         side = 1
), conversions_fees as (
    SELECT
        תאריך_חשבונית,
        'שער' as חשבון_חובה_1,
        to_char(float8 (CASE WHEN event_amount > 0 THEN
            ((
                select סכום_זכות_1
                from full_report_selection t1
                where
                    t1.is_conversion is true and
                    side = 1 and
                    אסמכתא_1 = t1.אסמכתא_1 and
                    t1.event_amount < 0
            )::float - סכום_חובה_1::float)
        END), 'FM999999999.00') as סכום_חובה_1,
        '' as מטח_סכום_חובה_1,
        '' as מטבע,
        '' as חשבון_זכות_1,
        '' as סכום_זכות_1,
        '' as מטח_זכות_חובה_1,
        '' AS חשבון_חובה_2,
        '' AS סכום_חובה_2,
        '' AS מטח_סכום_חובה_2,
        '' AS חשבון_זכות_2,
        '' AS סכום_זכות_2,
        '' AS מטח_סכום_זכות_2,
        פרטים,
        אסמכתא_1,
        '' AS אסמכתא_2,
        '' AS סוג_תנועה,
        תאריך_ערך,
        תאריך_3,
        id as original_id,
        'conversions_fees' as origin,
        proforma_invoice_file
    FROM full_report_selection
    WHERE
         is_conversion IS TRUE AND
         side = 1 and
         event_amount > 0
), invoice_rates_change as (
    SELECT
            תאריך_חשבונית AS תאריך_חשבונית,
            'שער' AS חשבון_חובה_1,
            to_char(float8 (
                -- TODO: Remove this when we suport currency on invoice_amount
                (case
                    when financial_entity = 'Uri Goldshtein' then tax_invoice_amount::float - formatted_event_amount_in_ils::float
                    when (tax_invoice_amount IS NOT NULL AND tax_invoice_amount <> 0 AND ABS(tax_invoice_amount) <> event_amount)
                        then (formatted_invoice_amount_in_ils_if_exists::float - (CASE
                                        WHEN currency_code = 'EUR' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.eur_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                        WHEN currency_code = 'USD' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.usd_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                    END)
                            ) - formatted_event_amount_in_ils::float
                    else formatted_invoice_amount_in_ils_if_exists::float - formatted_event_amount_in_ils::float
                   end))*-1
                , 'FM999999999.00') as סכום_חובה_1,
            '' AS מטח_סכום_חובה_1,
            '' AS מטבע,
            (case
                when financial_entity = 'Poalim' then ''
                else formatted_financial_entity
            end) AS חשבון_זכות_1,
            (case
                when financial_entity = 'Poalim' then ''
                else to_char(float8 (
                    (case
                    when financial_entity = 'Uri Goldshtein' then tax_invoice_amount::float - formatted_event_amount_in_ils::float

                    when (tax_invoice_amount IS NOT NULL AND tax_invoice_amount <> 0 AND ABS(tax_invoice_amount) <> event_amount)

                        then (formatted_invoice_amount_in_ils_if_exists::float - (CASE
                                        WHEN currency_code = 'EUR' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.eur_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                        WHEN currency_code = 'USD' THEN (event_amount - ABS(tax_invoice_amount)) * (
                                            select all_exchange_dates.usd_rate
                                            from all_exchange_dates
                                            where all_exchange_dates.exchange_date = debit_date::text::date
                                        )
                                    END)
                            ) - formatted_event_amount_in_ils::float


                    else formatted_invoice_amount_in_ils_if_exists::float - formatted_event_amount_in_ils::float
                   end)
                    )*-1, 'FM999999999.00')
            end) as סכום_זכות_1,
            '' AS מטח_סכום_זכות_1,
            '' AS חשבון_חובה_2,
            '' AS סכום_חובה_2,
            '' AS מטח_סכום_חובה_2,
            '' AS חשבון_זכות_2,
            '' AS סכום_זכות_2,
            '' AS מטח_סכום_זכות_2,
            פרטים AS פרטים,
            אסמכתא_1 AS אסמכתא_1,
            אסמכתא_2 AS אסמכתא_2,
            '' AS סוג_תנועה,
           תאריך_ערך AS תאריך_ערך,
           תאריך_3 AS תאריך_3,
           id as original_id,
           'invoice_rates_change' as origin,
           proforma_invoice_file
    FROM full_report_selection
    WHERE
         (
         (tax_invoice_date <> debit_date and
        (select all_exchange_dates.usd_rate
         from all_exchange_dates
         where all_exchange_dates.exchange_date = debit_date::text::date) <> (
         select all_exchange_dates.usd_rate
         from all_exchange_dates
         where all_exchange_dates.exchange_date = tax_invoice_date::text::date))
         or
          (
            financial_entity = 'Uri Goldshtein' and
            (tax_invoice_amount::float - formatted_event_amount_in_ils::float) <> 0
          )
         ) and
         account_type != 'creditcard' and
         currency_code != 'ILS' and
         side = 0
), transfer_fees as (
    SELECT
            formatted_event_date AS תאריך_חשבונית,
            'עמל' AS חשבון_חובה_1,
            to_char(float8 (CASE
                WHEN currency_code = 'EUR' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
            END), 'FM999999999.00') AS סכום_חובה_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS מטח_סכום_חובה_1,
            formatted_currency AS מטבע,
            financial_entity AS חשבון_זכות_1,
            to_char(float8 (CASE
                WHEN currency_code = 'EUR' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.eur_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
                WHEN currency_code = 'USD' THEN (ABS(tax_invoice_amount) - event_amount) * (
                    select all_exchange_dates.usd_rate
                    from all_exchange_dates
                    where all_exchange_dates.exchange_date = debit_date::text::date
                )
            END), 'FM999999999.00') AS סכום_זכות_1,
            to_char(float8 (ABS(tax_invoice_amount) - event_amount), 'FM999999999.00') AS מטח_סכום_זכות_1,
            '' AS חשבון_חובה_2,
            '' AS סכום_חובה_2,
            '' AS מטח_סכום_חובה_2,
            '' AS חשבון_זכות_2,
            '' AS סכום_זכות_2,
            '' AS מטח_סכום_זכות_2,
            user_description AS פרטים,
            bank_reference AS אסמכתא_1,
            '' AS אסמכתא_2,
            '' AS סוג_תנועה,
           formatted_debit_date AS תאריך_ערך,
           formatted_event_date AS תאריך_3,
           id as original_id,
           'transfer_fees' as origin,
           proforma_invoice_file
    FROM this_month_business
    WHERE
         tax_invoice_amount IS NOT NULL AND
         tax_invoice_amount <> 0 AND
         ABS(tax_invoice_amount) <> event_amount AND
         currency_code != 'ILS' and
         financial_entity != 'Uri Goldshtein' -- TODO: Until handling tax invoice currency
), withholding_tax as (
    SELECT
            formatted_event_date AS תאריך_חשבונית,
            'ניבמלק' AS חשבון_חובה_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS סכום_חובה_1,
            null,
            formatted_currency AS מטבע,
            financial_entity AS חשבון_זכות_1,
            to_char(float8 (ABS(tax_invoice_amount + COALESCE(vat, 0)) - event_amount), 'FM999999999.00') AS סכום_זכות_1,
            null AS מטח_סכום_זכות_1,
            '' AS חשבון_חובה_2,
            '' AS סכום_חובה_2,
            '' AS מטח_סכום_חובה_2,
            '' AS חשבון_זכות_2,
            '' AS סכום_זכות_2,
            '' AS מטח_סכום_זכות_2,
            user_description AS פרטים,
            bank_reference AS אסמכתא_1,
            tax_invoice_number AS אסמכתא_2,
            '' AS סוג_תנועה,
           formatted_debit_date AS תאריך_ערך,
           formatted_event_date AS תאריך_3,
           id as original_id,
           'withholding_tax' as origin,
           proforma_invoice_file
    FROM this_month_business
    WHERE
         tax_invoice_amount IS NOT NULL AND
         tax_invoice_amount <> 0 AND
         ABS(tax_invoice_amount) <> event_amount AND
         withholding_tax IS NOT NULL
), all_reports as (
    SELECT * FROM two_sides
    UNION ALL
    SELECT * FROM one_side
    UNION ALL
    SELECT * FROM invoice_rates_change
    UNION ALL
    SELECT * FROM conversions
    UNION ALL
    SELECT * FROM conversions_fees
    UNION ALL
    SELECT * FROM transfer_fees
    UNION ALL
    SELECT * FROM withholding_tax
), checking_asmachta2 as (
    SELECT
           אסמכתא_2,
           פרטים,
           *
    FROM full_report_selection
    WHERE
        personal_category <> 'conversion' AND
        financial_entity <> 'Isracard' AND
        financial_entity <> 'Uri Goldshtein' AND
        financial_entity <> 'Poalim' AND
        אסמכתא_2 IS NULL
)
SELECT *
FROM all_reports
ORDER BY to_date(תאריך_חשבונית, 'DD/MM/YYYY'), אסמכתא_1 desc, אסמכתא_2 desc, סכום_חובה_1 desc, חשבון_חובה_1 desc;



$$;