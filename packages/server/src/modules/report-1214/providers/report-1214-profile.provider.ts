import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import {
  translateReport1214ProfileWriteError,
  type Report1214ProfilePatch,
} from '../helpers/report-1214-profile.helper.js';
import type {
  IGetReport1214ProfilesByOwnerAndYearsQuery,
  IGetReport1214ProfilesByOwnerAndYearsResult,
  IUpsertReport1214ProfileQuery,
} from '../types.js';

const getReport1214ProfilesByOwnerAndYears = sql<IGetReport1214ProfilesByOwnerAndYearsQuery>`
  SELECT p.*
  FROM accounter_schema.report_1214_profiles p
  WHERE (p.owner_id, p.year) IN (
    SELECT k.owner_id, k.year
    FROM unnest($ownerIds::uuid[], $years::smallint[]) AS k(owner_id, year)
  );`;

/**
 * Creates or updates one profile row. A NULL parameter keeps the stored block (or the column
 * default `{}` / `[]` on insert); the caller passes `'{}'` / `'[]'` to clear a block.
 */
const upsertReport1214Profile = sql<IUpsertReport1214ProfileQuery>`
  INSERT INTO accounter_schema.report_1214_profiles (
    owner_id,
    year,
    company,
    declarations,
    preparer,
    attachments,
    bank_account,
    other_taxable_income,
    capital_gains_summary,
    qualifying_company,
    related_companies,
    rd_investments,
    amount_overrides
  )
  VALUES (
    $ownerId,
    $year,
    COALESCE($company::jsonb, '{}'::jsonb),
    COALESCE($declarations::jsonb, '{}'::jsonb),
    COALESCE($preparer::jsonb, '{}'::jsonb),
    COALESCE($attachments::jsonb, '{}'::jsonb),
    COALESCE($bankAccount::jsonb, '{}'::jsonb),
    COALESCE($otherTaxableIncome::jsonb, '{}'::jsonb),
    COALESCE($capitalGainsSummary::jsonb, '{}'::jsonb),
    COALESCE($qualifyingCompany::jsonb, '{}'::jsonb),
    COALESCE($relatedCompanies::jsonb, '[]'::jsonb),
    COALESCE($rdInvestments::jsonb, '[]'::jsonb),
    COALESCE($amountOverrides::jsonb, '{}'::jsonb)
  )
  ON CONFLICT (owner_id, year) DO UPDATE SET
    company = COALESCE($company::jsonb, report_1214_profiles.company),
    declarations = COALESCE($declarations::jsonb, report_1214_profiles.declarations),
    preparer = COALESCE($preparer::jsonb, report_1214_profiles.preparer),
    attachments = COALESCE($attachments::jsonb, report_1214_profiles.attachments),
    bank_account = COALESCE($bankAccount::jsonb, report_1214_profiles.bank_account),
    other_taxable_income = COALESCE($otherTaxableIncome::jsonb, report_1214_profiles.other_taxable_income),
    capital_gains_summary = COALESCE($capitalGainsSummary::jsonb, report_1214_profiles.capital_gains_summary),
    qualifying_company = COALESCE($qualifyingCompany::jsonb, report_1214_profiles.qualifying_company),
    related_companies = COALESCE($relatedCompanies::jsonb, report_1214_profiles.related_companies),
    rd_investments = COALESCE($rdInvestments::jsonb, report_1214_profiles.rd_investments),
    amount_overrides = COALESCE($amountOverrides::jsonb, report_1214_profiles.amount_overrides)
  RETURNING *;`;

type OwnerYearKey = { ownerId: string; year: number };

/** Serializes a block for its JSONB parameter; `undefined` (keep the stored block) is NULL. */
function toJsonParam(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class Report1214ProfileProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchProfilesByOwnerAndYears(keys: readonly OwnerYearKey[]) {
    const rows = await getReport1214ProfilesByOwnerAndYears.run(
      {
        ownerIds: keys.map(key => key.ownerId),
        years: keys.map(key => key.year),
      },
      this.db,
    );
    return keys.map(
      ({ ownerId, year }) =>
        rows.find(row => row.owner_id === ownerId && row.year === year) ?? null,
    );
  }

  /** The owner's profile row of a tax year, or `null` when none is stored. */
  public getProfileByOwnerAndYearLoader = new DataLoader(
    (keys: readonly OwnerYearKey[]) => this.batchProfilesByOwnerAndYears(keys),
    { cacheKeyFn: ({ ownerId, year }) => `${ownerId}:${year}` },
  );

  /**
   * Creates or updates the owner's profile of a tax year. Each block of `patch` that is
   * `undefined` is kept as stored; any other value replaces the stored block (`{}` / `[]` clear
   * it). The patch must already be validated and normalized (`normalizeReport1214ProfileInput`).
   */
  public async upsertProfile(
    ownerId: string,
    year: number,
    patch: Report1214ProfilePatch,
  ): Promise<IGetReport1214ProfilesByOwnerAndYearsResult> {
    try {
      const [row] = await upsertReport1214Profile.run(
        {
          ownerId,
          year,
          company: toJsonParam(patch.company),
          declarations: toJsonParam(patch.declarations),
          preparer: toJsonParam(patch.preparer),
          attachments: toJsonParam(patch.attachments),
          bankAccount: toJsonParam(patch.bankAccount),
          otherTaxableIncome: toJsonParam(patch.otherTaxableIncome),
          capitalGainsSummary: toJsonParam(patch.capitalGainsSummary),
          qualifyingCompany: toJsonParam(patch.qualifyingCompany),
          relatedCompanies: toJsonParam(patch.relatedCompanies),
          rdInvestments: toJsonParam(patch.rdInvestments),
          amountOverrides: toJsonParam(patch.amountOverrides),
        },
        this.db,
      );
      return row;
    } catch (error) {
      throw translateReport1214ProfileWriteError(error, ownerId, year);
    } finally {
      this.clearCache();
    }
  }

  public clearCache() {
    this.getProfileByOwnerAndYearLoader.clearAll();
  }
}
