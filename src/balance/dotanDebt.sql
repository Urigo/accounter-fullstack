CREATE OR REPLACE VIEW dotan_dept AS
SELECT event_date,
       event_amount,
       currency_code,
       event_amount_in_usd_with_vat_if_exists,
       SUM((event_amount_in_usd_with_vat_if_exists / 2) * -1)
       OVER (ORDER BY event_date, event_number, event_amount, bank_reference, account_number) as sum_till_this_point,
       bank_reference,
       account_number,
       event_number
FROM formatted_merged_tables
WHERE (account_number = 2733 OR account_number = 61066)
  AND event_date::date >= '2019-12-01'::timestamp
  AND financial_accounts_to_balance = 'no'
ORDER BY event_date, event_number, event_amount, bank_reference, account_number;

CREATE OR REPLACE VIEW dotan_future_dept AS
SELECT event_date,
       event_amount,
       currency_code,
       financial_entity,
       user_description,
       SUM((
                   (CASE
                        WHEN currency_code = 'ILS' THEN (event_amount / (
                            select all_exchange_dates.usd_rate
                            from all_exchange_dates
                            order by all_exchange_dates.exchange_date desc
                            limit 1
                        ))
                        WHEN currency_code = 'EUR' THEN event_amount / (
                                (
                                    select all_exchange_dates.eur_rate
                                    from all_exchange_dates
                                    order by all_exchange_dates.exchange_date desc
                                    limit 1
                                ) / (
                                    select all_exchange_dates.usd_rate
                                    from all_exchange_dates
                                    order by all_exchange_dates.exchange_date desc
                                    limit 1
                                )
                            )
                        WHEN currency_code = 'USD' THEN event_amount
                        ELSE -99999999999
                       END) / 2) * -1)
       OVER (ORDER BY event_date, event_amount, user_description, account_number) as sum_till_this_point
FROM accounter_schema.future_transactions
WHERE (account_number = 2733 OR account_number = 61066)
  AND event_date::date >= '2019-12-01'::timestamp
  AND financial_accounts_to_balance = 'no'
ORDER BY event_date, event_amount, user_description, account_number;