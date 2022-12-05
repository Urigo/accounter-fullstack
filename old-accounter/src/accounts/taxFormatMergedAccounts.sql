SELECT
  *
FROM
  formatted_merged_tables;

DROP VIEW
  formatted_merged_tables CASCADE;

CREATE OR REPLACE VIEW
  formatted_merged_tables AS
WITH
  all_exchange_dates AS (
    SELECT
      dt AS exchange_date,
      (
        SELECT
          t1.eur
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) eur_rate,
      (
        SELECT
          t1.usd
        FROM
          accounter_schema.exchange_rates t1
        WHERE
          date_trunc('day', t1.exchange_date)::date <= times_table.dt
        ORDER BY
          t1.exchange_date DESC
        LIMIT
          1
      ) usd_rate
    FROM
      times_table
    ORDER BY
      dt
  )
SELECT
  *,
  (
    CASE
      WHEN account_type = 'checking_ils' THEN 'עוש'
      WHEN account_type = 'checking_usd' THEN 'עוש1'
      WHEN account_type = 'checking_eur' THEN 'עוש2'
      WHEN account_type = 'creditcard' THEN 'כא'
      ELSE 'unknown account!!'
    END
  ) AS formatted_account,
  (
    CASE
      WHEN financial_entity = 'Poalim' THEN 'עמל'
      WHEN financial_entity = 'Tax Corona Grant' THEN 'מענק קורונה'
      WHEN tax_category = 'Uri Goldshtein Hoz' THEN 'אוריח'
      ELSE tax_category
    END
  ) AS formatted_tax_category,
  (
    CASE
      WHEN financial_entity = 'Hot Mobile' THEN 'הוט'
      WHEN financial_entity = 'Dotan Simha' THEN 'דותן'
      WHEN financial_entity = 'Kamil Kisiela' THEN 'Kamil'
      WHEN financial_entity = 'MapMe' THEN 'מאפלאבס'
      WHEN financial_entity = 'Idan Am-Shalem' THEN 'עםשלם'
      WHEN financial_entity = 'Isracard' THEN 'כא'
      WHEN financial_entity = 'Poalim' THEN 'Poalim Bank'
      WHEN financial_entity = 'VAT' THEN 'מעמחוז'
      WHEN financial_entity = 'Israeli Corporations Authority' THEN 'רשם החברות'
      WHEN financial_entity = 'SATURN AMSTERDAM ODE' THEN 'SATURN AMS'
      WHEN financial_entity = 'Linux Foundation' THEN 'LinuxFound'
      WHEN financial_entity = 'Malach' THEN 'מלאך'
      WHEN financial_entity = 'Spaans&Spaans' THEN 'Spaans'
      WHEN financial_entity = 'IMPACT HUB ATHENS' THEN 'IMPACT HUB ATHE'
      WHEN financial_entity = 'ENTERPRISE GRAPHQL Conference' THEN 'ENTERPRISE GRAP'
      WHEN financial_entity = 'Yaacov Matri' THEN 'יעקב'
      WHEN financial_entity = 'Tax' THEN (
        CASE
          WHEN event_date::TEXT::date <= '2019-11-30' THEN 'מקדמות19'
          WHEN (
            event_date::TEXT::date <= '2020-01-31'
            AND event_date::TEXT::date > '2019-11-30'
          ) THEN 'מקדמותל'
          WHEN (
            event_date::TEXT::date <= '2021-01-31'
            AND event_date::TEXT::date > '2020-11-30'
          ) THEN 'מקדמות20'
          WHEN event_date::TEXT::date > '2021-01-31' THEN 'מקדמות21'
        END
      )
      WHEN financial_entity = 'Tax Deductions' THEN 'מהני'
      WHEN financial_entity = 'Social Security Deductions' THEN 'בלני'
      WHEN financial_entity = 'Uri Goldshtein' THEN 'אורי'
      WHEN financial_entity = 'Uri Goldshtein Hoz' THEN 'אוריח'
      WHEN tax_category = 'Uri Goldshtein Hoz' THEN 'אוריח'
      WHEN financial_entity = 'Raveh Ravid & Co' THEN 'יהל'
      WHEN financial_entity = 'Production Ready GraphQL' THEN 'ProdReadyGraph'
      WHEN financial_entity = 'הפרשי שער' THEN 'שער'
      WHEN financial_entity = 'Tax Corona Grant' THEN 'מענק קורונה'
      WHEN financial_entity = 'VAT interest refund' THEN 'מעמ שער'
      WHEN financial_entity = 'Tax Shuma' THEN 'שומה 2018'
      ELSE financial_entity
    END
  ) AS formatted_financial_entity,
  to_char(event_date, 'DD/MM/YYYY') AS formatted_event_date,
  to_char(tax_invoice_date, 'DD/MM/YYYY') AS formatted_tax_invoice_date,
  to_char(debit_date, 'DD/MM/YYYY') AS formatted_debit_date,
  (
    CASE
      WHEN tax_category = 'פלאפון' THEN ((vat::FLOAT / 3) * 2)
      WHEN tax_category = 'ציוד' THEN ((vat::FLOAT / 3) * 2)
      WHEN tax_category = 'מידע' THEN ((vat::FLOAT / 3) * 2)
      ELSE vat
    END
  ) AS real_vat,
  (
    CASE
      WHEN currency_code = 'ILS' THEN event_amount / (
        SELECT
          usd
        FROM
          accounter_schema.exchange_rates
        WHERE
          exchange_date = debit_date::TEXT::date
      )
      WHEN currency_code = 'EUR' THEN event_amount * (
        (
          SELECT
            all_exchange_dates.eur_rate
          FROM
            all_exchange_dates
          WHERE
            all_exchange_dates.exchange_date = debit_date::TEXT::date
        ) / (
          SELECT
            all_exchange_dates.usd_rate
          FROM
            all_exchange_dates
          WHERE
            all_exchange_dates.exchange_date = debit_date::TEXT::date
        )
      )
      WHEN currency_code = 'USD' THEN event_amount
      ELSE -99999999999
    END
  ) AS event_amount_in_usd,
  (
    CASE
      WHEN currency_code = 'ILS' THEN (event_amount - COALESCE(vat, 0)) / (
        SELECT
          all_exchange_dates.usd_rate
        FROM
          all_exchange_dates
        WHERE
          all_exchange_dates.exchange_date = debit_date::TEXT::date
      )
      WHEN currency_code = 'EUR' THEN (event_amount - COALESCE(vat, 0)) * (
        (
          SELECT
            all_exchange_dates.eur_rate
          FROM
            all_exchange_dates
          WHERE
            all_exchange_dates.exchange_date = debit_date::TEXT::date
        ) / (
          SELECT
            all_exchange_dates.usd_rate
          FROM
            all_exchange_dates
          WHERE
            all_exchange_dates.exchange_date = debit_date::TEXT::date
        )
      )
      WHEN currency_code = 'USD' THEN event_amount - COALESCE(vat, 0)
      ELSE -99999999999
    END
  ) AS event_amount_in_usd_with_vat_if_exists,
  to_char(
    float8 (
      ABS(
        (
          CASE
            WHEN currency_code = 'ILS' THEN event_amount
            WHEN currency_code = 'EUR' THEN event_amount * (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
            WHEN currency_code = 'USD' THEN event_amount * (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
            ELSE -99999999999
          END
        )
      )
    ),
    'FM999999999.00'
  ) AS formatted_event_amount_in_ils,
  to_char(
    float8 (
      ABS(
        (
          CASE
            WHEN currency_code = 'ILS' THEN event_amount + COALESCE(interest, 0)
            WHEN currency_code = 'EUR' THEN event_amount * (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
            WHEN currency_code = 'USD' THEN event_amount * (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
            ELSE -99999999999
          END
        )
      )
    ),
    'FM999999999.00'
  ) AS formatted_event_amount_in_ils_with_interest,
  to_char(
    float8 (
      ABS(
        (
          CASE
            WHEN (
              tax_invoice_amount IS NOT NULL
              AND tax_invoice_amount <> 0
              AND ABS(tax_invoice_amount) <> event_amount
            ) THEN tax_invoice_amount
            ELSE event_amount
          END
        )
      )
    ),
    'FM999999999.00'
  ) AS formatted_invoice_amount_if_exists,
  to_char(
    float8 (
      ABS(
        (
          CASE
            WHEN currency_code = 'ILS' THEN (
              CASE
                WHEN (
                  tax_invoice_amount IS NOT NULL
                  AND tax_invoice_amount <> 0
                  AND ABS(tax_invoice_amount) <> event_amount
                ) THEN tax_invoice_amount - COALESCE(
                  (
                    CASE
                      WHEN tax_category = 'פלאפון' THEN ((vat::FLOAT / 3) * 2)
                      WHEN tax_category = 'ציוד' THEN ((vat::FLOAT / 3) * 2)
                      WHEN tax_category = 'מידע' THEN ((vat::FLOAT / 3) * 2)
                      ELSE vat
                    END
                  ),
                  0
                )
                ELSE event_amount
              END
            )
            WHEN currency_code = 'EUR' THEN (
              CASE
                WHEN (
                  tax_invoice_amount IS NOT NULL
                  AND tax_invoice_amount <> 0
                  AND ABS(tax_invoice_amount) <> event_amount
                ) THEN tax_invoice_amount - COALESCE(vat, 0)
                ELSE event_amount - COALESCE(vat, 0)
              END
            ) * (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = (
                  CASE
                    WHEN (
                      tax_invoice_date IS NOT NULL
                      AND account_type != 'creditcard'
                    ) THEN tax_invoice_date::TEXT::date
                    ELSE debit_date::TEXT::date
                  END
                )
            )
            WHEN currency_code = 'USD' THEN (
              CASE
                WHEN (
                  tax_invoice_amount IS NOT NULL
                  AND tax_invoice_amount <> 0
                  AND ABS(tax_invoice_amount) <> event_amount
                ) THEN tax_invoice_amount - COALESCE(vat, 0)
                ELSE event_amount - COALESCE(vat, 0)
              END
            ) * (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = (
                  CASE
                    WHEN (
                      tax_invoice_date IS NOT NULL
                      AND account_type != 'creditcard'
                    ) THEN tax_invoice_date::TEXT::date
                    ELSE debit_date::TEXT::date
                  END
                )
            )
            ELSE -99999999999
          END
        )
      )
    ),
    'FM999999999.00'
  ) AS formatted_invoice_amount_in_ils_with_vat_if_exists,
  to_char(
    float8 (
      ABS(
        (
          CASE
            WHEN currency_code = 'ILS' THEN (
              CASE
                WHEN (
                  tax_invoice_amount IS NOT NULL
                  AND tax_invoice_amount <> 0
                  AND ABS(tax_invoice_amount) <> event_amount
                ) THEN tax_invoice_amount
                ELSE event_amount - COALESCE(
                  (
                    CASE
                      WHEN tax_category = 'פלאפון' THEN ((vat::FLOAT / 3) * 2)
                      WHEN tax_category = 'ציוד' THEN ((vat::FLOAT / 3) * 2)
                      WHEN tax_category = 'מידע' THEN ((vat::FLOAT / 3) * 2)
                      ELSE vat
                    END
                  ),
                  0
                )
              END
            )
            WHEN currency_code = 'EUR' THEN (
              CASE
                WHEN (
                  tax_invoice_amount IS NOT NULL
                  AND tax_invoice_amount <> 0
                  AND ABS(tax_invoice_amount) <> event_amount
                ) THEN tax_invoice_amount
                ELSE event_amount - COALESCE(vat, 0)
              END
            ) * (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = (
                  CASE
                    WHEN (
                      tax_invoice_date IS NOT NULL
                      AND account_type != 'creditcard'
                    ) THEN tax_invoice_date::TEXT::date
                    ELSE debit_date::TEXT::date
                  END
                )
            )
            WHEN currency_code = 'USD' THEN (
              CASE
                WHEN (
                  tax_invoice_amount IS NOT NULL
                  AND tax_invoice_amount <> 0
                  AND ABS(tax_invoice_amount) <> event_amount
                ) THEN tax_invoice_amount
                ELSE event_amount - COALESCE(vat, 0)
              END
            ) * (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = (
                  CASE
                    WHEN (
                      tax_invoice_date IS NOT NULL
                      AND account_type != 'creditcard'
                    ) THEN tax_invoice_date::TEXT::date
                    ELSE debit_date::TEXT::date
                  END
                )
            )
            ELSE -99999999999
          END
        )
      )
    ),
    'FM999999999.00'
  ) AS formatted_invoice_amount_in_ils_if_exists,
  to_char(
    float8 (
      ABS(
        (
          CASE
            WHEN currency_code = 'ILS' THEN (event_amount - COALESCE(vat, 0))
            WHEN currency_code = 'EUR' THEN (event_amount - COALESCE(vat, 0)) * (
              SELECT
                all_exchange_dates.eur_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
            WHEN currency_code = 'USD' THEN (event_amount - COALESCE(vat, 0)) * (
              SELECT
                all_exchange_dates.usd_rate
              FROM
                all_exchange_dates
              WHERE
                all_exchange_dates.exchange_date = debit_date::TEXT::date
            )
            ELSE -99999999999
          END
        )
      )
    ),
    'FM999999999.00'
  ) AS formatted_event_amount_in_ils_with_vat_if_exist,
  to_char(
    float8 (
      CASE
        WHEN currency_code != 'ILS' THEN ABS(event_amount) --                 ELSE NULL
      END
    ),
    'FM999999999.00'
  ) AS formatted_foreign_amount_if_exist,
  to_char(
    float8 (
      CASE
        WHEN currency_code != 'ILS' THEN ABS(
          (
            CASE
              WHEN (
                tax_invoice_amount IS NOT NULL
                AND tax_invoice_amount <> 0
                AND ABS(tax_invoice_amount) <> event_amount
              ) THEN tax_invoice_amount - COALESCE(vat, 0)
              ELSE event_amount - COALESCE(vat, 0)
            END
          )
        ) --                 ELSE NULL
      END
    ),
    'FM999999999.00'
  ) AS formatted_invoice_foreign_amount_if_exist,
  (
    CASE
      WHEN currency_code = 'USD' THEN '$'
      WHEN currency_code = 'EUR' THEN 'אירו'
      ELSE ''
    END
  ) AS formatted_currency,
  (
    CASE
      WHEN currency_code != 'ILS' THEN vat
    END
  ) AS formatted_foreign_vat,
  (
    CASE
      WHEN currency_code = 'USD' THEN vat * (
        SELECT
          all_exchange_dates.usd_rate
        FROM
          all_exchange_dates
        WHERE
          all_exchange_dates.exchange_date = tax_invoice_date::TEXT::date
      )
      WHEN currency_code = 'EUR' THEN vat * (
        SELECT
          all_exchange_dates.eur_rate
        FROM
          all_exchange_dates
        WHERE
          all_exchange_dates.exchange_date = tax_invoice_date::TEXT::date
      )
    END
  ) AS formatted_foreign_vat_in_ils
FROM
  accounter_schema.all_transactions -- where event_date > '2019-12-31';
