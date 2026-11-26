import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Storage for the annual company report, form 1214 (OPCN 1214), per tenant and tax year.
 *
 * `report_1214_profiles` holds what the ledger cannot derive: one row per (owner, year), one
 * JSONB column per section of `@accounter/opcn1214-generator`'s `Report1214Input`
 * (`src/model/input.ts`), in the same camelCase shape, so the server maps them mostly as a
 * pass-through. Array sections default to `[]` and object sections to `{}`, so a row created by a
 * partial upsert is always readable without null checks. `amount_overrides` is a
 * `{ "<code>": number }` map that wins over the auto-computed main-form amounts.
 *
 * `shareholders` is kept relational (one row per shareholder per year) rather than as JSONB on the
 * profile, so form 1214ב, dividends and later years can reuse it. Columns mirror the generator's
 * `Shareholder`. `business_id` optionally links the shareholder to its financial entity.
 * `id_number` is unique per owner and year, except for the generator's shared placeholder IDs
 * `999999964` (not registered in Israel) and `999999998` (public holding), which many shareholders
 * may carry (SPEC p.22), hence a partial unique index rather than a unique constraint.
 *
 * Both tables follow the tenant RLS of `2026-11-22T12-00-00.add-poalim-deposit-tax-events-table`.
 * `shareholders.id` defaults to `uuidv7()`, per `uuidv7-id-defaults.test.ts`.
 *
 * The migrator runs forward only. To roll back by hand:
 * `DROP TABLE IF EXISTS accounter_schema.shareholders, accounter_schema.report_1214_profiles;`
 */
export default {
  name: '2026-11-25T12-00-00.report-1214-profile-and-shareholders.sql',
  run: ({ sql }) => sql`
create table if not exists accounter_schema.report_1214_profiles
(
    owner_id              uuid                          not null
        constraint report_1214_profiles_businesses_id_fk
            references accounter_schema.businesses,
    year                  smallint                      not null,
    company               jsonb       default '{}'::jsonb not null,
    declarations          jsonb       default '{}'::jsonb not null,
    preparer              jsonb       default '{}'::jsonb not null,
    attachments           jsonb       default '{}'::jsonb not null,
    bank_account          jsonb       default '{}'::jsonb not null,
    other_taxable_income  jsonb       default '{}'::jsonb not null,
    capital_gains_summary jsonb       default '{}'::jsonb not null,
    qualifying_company    jsonb       default '{}'::jsonb not null,
    related_companies     jsonb       default '[]'::jsonb not null,
    rd_investments        jsonb       default '[]'::jsonb not null,
    amount_overrides      jsonb       default '{}'::jsonb not null,
    created_at            timestamptz default now()     not null,
    updated_at            timestamptz default now()     not null,
    constraint report_1214_profiles_pk
        primary key (owner_id, year),
    constraint report_1214_profiles_year_check
        check (year between 2000 and 2100),
    constraint report_1214_profiles_objects_check
        check (
            jsonb_typeof(company) = 'object'
            and jsonb_typeof(declarations) = 'object'
            and jsonb_typeof(preparer) = 'object'
            and jsonb_typeof(attachments) = 'object'
            and jsonb_typeof(bank_account) = 'object'
            and jsonb_typeof(other_taxable_income) = 'object'
            and jsonb_typeof(capital_gains_summary) = 'object'
            and jsonb_typeof(qualifying_company) = 'object'
            and jsonb_typeof(amount_overrides) = 'object'
        ),
    constraint report_1214_profiles_arrays_check
        check (
            jsonb_typeof(related_companies) = 'array'
            and jsonb_typeof(rd_investments) = 'array'
        )
);

comment on table accounter_schema.report_1214_profiles is
    'Form 1214 (OPCN 1214) user-entered data per owner and tax year. JSONB shapes mirror the camelCase input types of @accounter/opcn1214-generator (src/model/input.ts, Report1214Input).';
comment on column accounter_schema.report_1214_profiles.company is
    'Overrides and extras for CompanyDetails (phone, fax, email, occupation, mailing / business / books addresses).';
comment on column accounter_schema.report_1214_profiles.declarations is
    'Report1214Input.declarations (Declarations).';
comment on column accounter_schema.report_1214_profiles.preparer is
    'Report1214Input.preparer (PreparerDetails); {} when there is none.';
comment on column accounter_schema.report_1214_profiles.attachments is
    'Report1214Input.attachments (certificate counts).';
comment on column accounter_schema.report_1214_profiles.bank_account is
    'Report1214Input.bankAccount ({ bank, branch, account }); {} when the account on file is unchanged.';
comment on column accounter_schema.report_1214_profiles.other_taxable_income is
    'Report1214Input.otherTaxableIncome.';
comment on column accounter_schema.report_1214_profiles.capital_gains_summary is
    'Report1214Input.capitalGainsSummary.';
comment on column accounter_schema.report_1214_profiles.qualifying_company is
    'Report1214Input.qualifyingCompany.';
comment on column accounter_schema.report_1214_profiles.related_companies is
    'Report1214Input.relatedCompanies (RelatedCompany[], at most 3, validated by the generator).';
comment on column accounter_schema.report_1214_profiles.rd_investments is
    'Report1214Input.rdInvestments (RdInvestment[], at most 5, validated by the generator).';
comment on column accounter_schema.report_1214_profiles.amount_overrides is
    'Main-form amounts entered by hand, { "<code>": number }; they win over computed amounts.';

drop trigger if exists update_report_1214_profiles_updated_at
    on accounter_schema.report_1214_profiles;

create trigger update_report_1214_profiles_updated_at
    before update
    on accounter_schema.report_1214_profiles
    for each row
execute procedure accounter_schema.update_general_updated_at();

alter table accounter_schema.report_1214_profiles enable row level security;
alter table accounter_schema.report_1214_profiles force row level security;

drop policy if exists tenant_isolation on accounter_schema.report_1214_profiles;
create policy tenant_isolation on accounter_schema.report_1214_profiles
    for all
    using (owner_id = any (accounter_schema.get_current_business_scope()))
    with check (owner_id = accounter_schema.get_current_business_id());

drop policy if exists tenant_isolation_delete on accounter_schema.report_1214_profiles;
create policy tenant_isolation_delete on accounter_schema.report_1214_profiles
    as restrictive
    for delete
    using (owner_id = accounter_schema.get_current_business_id());

drop policy if exists tenant_isolation_update on accounter_schema.report_1214_profiles;
create policy tenant_isolation_update on accounter_schema.report_1214_profiles
    as restrictive
    for update
    using (owner_id = accounter_schema.get_current_business_id());

create table if not exists accounter_schema.shareholders
(
    id                      uuid        default uuidv7()  not null
        constraint shareholders_pk
            primary key,
    owner_id                uuid                          not null
        constraint shareholders_owner_businesses_id_fk
            references accounter_schema.businesses,
    year                    smallint                      not null,
    business_id             uuid
        constraint shareholders_business_businesses_id_fk
            references accounter_schema.businesses
            on delete set null,
    id_number               varchar(9)                    not null,
    full_name               text                          not null,
    is_controlling          boolean     default false     not null,
    dividend_rights_percent numeric(7, 4),
    voting_rights_percent   numeric(7, 4),
    other_rights_percent    numeric(7, 4),
    is_material             boolean,
    salary_months_1_to_9    numeric,
    salary_months_10_to_12  numeric,
    other_payments          numeric,
    sort_order              integer     default 0         not null,
    created_at              timestamptz default now()     not null,
    updated_at              timestamptz default now()     not null,
    constraint shareholders_year_check
        check (year between 2000 and 2100),
    constraint shareholders_id_number_check
        check (id_number ~ '^[0-9]{9}$'),
    constraint shareholders_dividend_rights_percent_check
        check (dividend_rights_percent between 0 and 100),
    constraint shareholders_voting_rights_percent_check
        check (voting_rights_percent between 0 and 100),
    constraint shareholders_other_rights_percent_check
        check (other_rights_percent between 0 and 100)
);

comment on table accounter_schema.shareholders is
    'Shareholders per owner and tax year (form 1214 records 1020, reusable by 1214b and dividends). Columns mirror Shareholder in @accounter/opcn1214-generator (src/model/input.ts).';
comment on column accounter_schema.shareholders.business_id is
    'Optional link to the shareholder''s own financial entity.';
comment on column accounter_schema.shareholders.id_number is
    'Israeli ID or company number, stored zero-padded to 9 digits (the generator accepts 1-9 digits and pads them), or a shared placeholder: 999999964 (not registered in Israel) / 999999998 (public holding). Unique per owner and year except for the placeholders.';
comment on column accounter_schema.shareholders.sort_order is
    'Order of the shareholder in the report.';

create index if not exists shareholders_owner_id_year_idx
    on accounter_schema.shareholders (owner_id, year);

create unique index if not exists shareholders_owner_year_id_number_key
    on accounter_schema.shareholders (owner_id, year, id_number)
    where id_number not in ('999999964', '999999998');

drop trigger if exists update_shareholders_updated_at
    on accounter_schema.shareholders;

create trigger update_shareholders_updated_at
    before update
    on accounter_schema.shareholders
    for each row
execute procedure accounter_schema.update_general_updated_at();

alter table accounter_schema.shareholders enable row level security;
alter table accounter_schema.shareholders force row level security;

drop policy if exists tenant_isolation on accounter_schema.shareholders;
create policy tenant_isolation on accounter_schema.shareholders
    for all
    using (owner_id = any (accounter_schema.get_current_business_scope()))
    with check (owner_id = accounter_schema.get_current_business_id());

drop policy if exists tenant_isolation_delete on accounter_schema.shareholders;
create policy tenant_isolation_delete on accounter_schema.shareholders
    as restrictive
    for delete
    using (owner_id = accounter_schema.get_current_business_id());

drop policy if exists tenant_isolation_update on accounter_schema.shareholders;
create policy tenant_isolation_update on accounter_schema.shareholders
    as restrictive
    for update
    using (owner_id = accounter_schema.get_current_business_id());
`,
} satisfies MigrationExecutor;
