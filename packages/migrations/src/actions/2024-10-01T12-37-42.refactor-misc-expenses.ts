import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-10-01T12-37-42.refactor-misc-expenses.sql',
  run: ({ sql }) => sql`
    create table if not exists accounter_schema.misc_expenses
    (
        id           uuid default gen_random_uuid() not null
            constraint misc_expenses_pk
                primary key,
        charge_id    uuid                           not null
            constraint misc_expenses_charge_id_fk
                references accounter_schema.charges,
        amount       numeric                        not null,
        currency     accounter_schema.currency      not null,
        description  text,
        creditor_id  uuid                           not null
            constraint misc_expenses_financial_entities_id_fk
                references accounter_schema.financial_entities,
        debtor_id    uuid                           not null
            constraint misc_expenses_financial_entities_id_fk_2
                references accounter_schema.financial_entities,
        invoice_date date                           not null,
        value_date   timestamp                      not null
    );

    create index if not exists misc_expenses_charge_id_index
        on accounter_schema.misc_expenses (charge_id);

    create index if not exists misc_expenses_creditor_id_index
        on accounter_schema.misc_expenses (creditor_id);

    create index if not exists misc_expenses_debtor_id_index
        on accounter_schema.misc_expenses (debtor_id);

    insert into accounter_schema.misc_expenses (charge_id, amount, currency, description, creditor_id, debtor_id,
                                                invoice_date, value_date)
    select old.charge_id,
          ABS(old.amount),
          old.currency,
          old.description,
          old.creditor_id,
          old.debtor_id,
          old.invoice_date,
          old.value_date
    from (select t.charge_id,
                ame.amount,
                t.currency,
                ame.description,
                case when ame.amount < 0 then t.business_id else ame.counterparty end as creditor_id,
                case when ame.amount > 0 then t.business_id else ame.counterparty end as debtor_id,
                COALESCE(ame.date, t.event_date)                                      as invoice_date,
                COALESCE(t.debit_timestamp, t.debit_date::timestamp)                  as value_date
          from accounter_schema.authorities_misc_expenses ame
                  left join accounter_schema.extended_transactions t
                            on t.id = ame.transaction_id) old;
    
    update accounter_schema.misc_expenses
        set debtor_id = '8cac6911-8389-4f81-bfc7-518070b821f4'
            where debtor_id = 'f2ae3379-b970-45c9-a998-aced20c25b31';

    create or replace view accounter_schema.extended_business_trip_transactions
                (id, business_trip_id, transaction_ids, charge_ids, category, date, value_date, amount, currency,
                employee_business_id, payed_by_employee)
    as
    WITH transactions_by_business_trip_transaction AS (SELECT tm.business_trip_transaction_id,
                                                              array_agg(DISTINCT t1.id)                          AS transaction_ids,
                                                              array_agg(DISTINCT t1.charge_id)                   AS charge_ids,
                                                              array_agg(DISTINCT t1.currency)                    AS currencies,
                                                              sum(tm.amount) AS amount,
                                                              min(t1.event_date)                                 AS event_date,
                                                              min(t1.debit_date)                                 AS debit_date
                                                      FROM accounter_schema.business_trips_transactions_match tm
                                                                LEFT JOIN accounter_schema.extended_transactions t1 ON t1.id = tm.transaction_id
                                                      GROUP BY tm.business_trip_transaction_id)
    SELECT DISTINCT ON (btt.id) btt.id,
                                btt.business_trip_id,
                                t.transaction_ids,
                                t.charge_ids,
                                btt.category,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.date
                                    ELSE t.event_date
                                    END                                AS date,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.value_date
                                    ELSE t.debit_date
                                    END                                AS value_date,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN
                                        CASE
                                            WHEN ep.amount IS NULL THEN NULL::numeric
                                            ELSE ep.amount * '-1'::integer::numeric
                                            END
                                    WHEN array_length(t.currencies, 1) = 1 THEN t.amount
                                    ELSE NULL::numeric
                                    END                                AS amount,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.currency
                                    WHEN array_length(t.currencies, 1) = 1 THEN t.currencies[1]
                                    ELSE NULL::accounter_schema.currency
                                    END                                AS currency,
                                ep.employee_business_id,
                                t.business_trip_transaction_id IS NULL AS payed_by_employee
    FROM accounter_schema.business_trips_transactions btt
            LEFT JOIN transactions_by_business_trip_transaction t ON t.business_trip_transaction_id = btt.id
            LEFT JOIN accounter_schema.business_trips_employee_payments ep ON ep.id = btt.id;

    drop table accounter_schema.authorities_misc_expenses;
`,
} satisfies MigrationExecutor;
