import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import {
  translateShareholdersWriteError,
  type ShareholderRowInput,
} from '../helpers/shareholders.helper.js';
import type {
  ICopyShareholdersQuery,
  IDeleteShareholdersByOwnerAndYearQuery,
  IGetShareholdersByOwnerAndYearsQuery,
  IGetShareholdersByOwnerAndYearsResult,
  IInsertShareholdersQuery,
  ILockShareholdersOfOwnerAndYearQuery,
} from '../types.js';

const getShareholdersByOwnerAndYears = sql<IGetShareholdersByOwnerAndYearsQuery>`
  SELECT s.*
  FROM accounter_schema.shareholders s
  WHERE (s.owner_id, s.year) IN (
    SELECT k.owner_id, k.year
    FROM unnest($ownerIds::uuid[], $years::smallint[]) AS k(owner_id, year)
  )
  ORDER BY s.sort_order, s.id;`;

/**
 * Serializes writes to one owner's shareholders of one year until the transaction ends, so two
 * overlapping replaces cannot interleave their delete and insert.
 */
const lockShareholdersOfOwnerAndYear = sql<ILockShareholdersOfOwnerAndYearQuery>`
  SELECT pg_advisory_xact_lock(hashtextextended(format('shareholders:%s:%s', $ownerId::uuid, $year::int), 0)) AS locked;`;

const deleteShareholdersByOwnerAndYear = sql<IDeleteShareholdersByOwnerAndYearQuery>`
  DELETE FROM accounter_schema.shareholders
  WHERE owner_id = $ownerId AND year = $year;`;

const insertShareholders = sql<IInsertShareholdersQuery>`
  INSERT INTO accounter_schema.shareholders (
    owner_id,
    year,
    business_id,
    id_number,
    full_name,
    is_controlling,
    dividend_rights_percent,
    voting_rights_percent,
    other_rights_percent,
    is_material,
    salary_months_1_to_9,
    salary_months_10_to_12,
    other_payments,
    sort_order
  )
  VALUES $$shareholders(
    ownerId,
    year,
    businessId,
    idNumber,
    fullName,
    isControlling,
    dividendRightsPercent,
    votingRightsPercent,
    otherRightsPercent,
    isMaterial,
    salaryMonths1To9,
    salaryMonths10To12,
    otherPayments,
    sortOrder
  )
  RETURNING *;`;

const copyShareholders = sql<ICopyShareholdersQuery>`
  INSERT INTO accounter_schema.shareholders (
    owner_id,
    year,
    business_id,
    id_number,
    full_name,
    is_controlling,
    dividend_rights_percent,
    voting_rights_percent,
    other_rights_percent,
    is_material,
    salary_months_1_to_9,
    salary_months_10_to_12,
    other_payments,
    sort_order
  )
  SELECT
    s.owner_id,
    $toYear,
    s.business_id,
    s.id_number,
    s.full_name,
    s.is_controlling,
    s.dividend_rights_percent,
    s.voting_rights_percent,
    s.other_rights_percent,
    s.is_material,
    s.salary_months_1_to_9,
    s.salary_months_10_to_12,
    s.other_payments,
    s.sort_order
  FROM accounter_schema.shareholders s
  WHERE s.owner_id = $ownerId AND s.year = $fromYear
  ORDER BY s.sort_order, s.id
  RETURNING *;`;

type OwnerYearKey = { ownerId: string; year: number };

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ShareholdersProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchShareholdersByOwnerAndYears(keys: readonly OwnerYearKey[]) {
    const rows = await getShareholdersByOwnerAndYears.run(
      {
        ownerIds: keys.map(key => key.ownerId),
        years: keys.map(key => key.year),
      },
      this.db,
    );
    // rows come ordered by sort_order, id: filtering keeps that order per key
    return keys.map(({ ownerId, year }) =>
      rows.filter(row => row.owner_id === ownerId && row.year === year),
    );
  }

  /** The owner's shareholders of a tax year, ordered by `sort_order, id`. */
  public getShareholdersByOwnerAndYearLoader = new DataLoader(
    (keys: readonly OwnerYearKey[]) => this.batchShareholdersByOwnerAndYears(keys),
    { cacheKeyFn: ({ ownerId, year }) => `${ownerId}:${year}` },
  );

  /**
   * Replaces the owner's shareholders of a tax year with `rows`, in one transaction: the old rows
   * are deleted and the new ones inserted, with `sort_order` set to each row's index. An empty
   * list clears the year. Rows must already be validated and normalized
   * (`normalizeShareholderInputs`).
   */
  public async replaceShareholders(
    ownerId: string,
    year: number,
    rows: ReadonlyArray<ShareholderRowInput>,
  ): Promise<IGetShareholdersByOwnerAndYearsResult[]> {
    try {
      return await this.db.transaction(async client => {
        await lockShareholdersOfOwnerAndYear.run({ ownerId, year }, client);
        await deleteShareholdersByOwnerAndYear.run({ ownerId, year }, client);
        if (rows.length === 0) {
          return [];
        }
        const inserted = await insertShareholders.run(
          {
            shareholders: rows.map((row, index) => ({
              ownerId,
              year,
              businessId: row.businessId,
              idNumber: row.idNumber,
              fullName: row.fullName,
              isControlling: row.isControllingShareholder,
              dividendRightsPercent: row.dividendRightsPercent,
              votingRightsPercent: row.votingRightsPercent,
              otherRightsPercent: row.otherRightsPercent,
              isMaterial: row.isMaterialShareholder,
              salaryMonths1To9: row.salaryMonths1To9,
              salaryMonths10To12: row.salaryMonths10To12,
              otherPayments: row.otherPayments,
              sortOrder: index,
            })),
          },
          client,
        );
        return inserted.sort((a, b) => a.sort_order - b.sort_order);
      });
    } catch (error) {
      throw translateShareholdersWriteError(error, ownerId, year);
    } finally {
      this.clearCache();
    }
  }

  /**
   * Copies the owner's shareholders of `fromYear` into `toYear`, keeping their order. Throws
   * `SHAREHOLDERS_TARGET_YEAR_NOT_EMPTY` when `toYear` already has shareholders (the caller is
   * expected to confirm with the user and replace them with `replaceShareholders` instead). Returns
   * an empty list when `fromYear` has none.
   */
  public async copyShareholders(
    ownerId: string,
    fromYear: number,
    toYear: number,
  ): Promise<IGetShareholdersByOwnerAndYearsResult[]> {
    try {
      return await this.db.transaction(async client => {
        await lockShareholdersOfOwnerAndYear.run({ ownerId, year: toYear }, client);
        const existing = await getShareholdersByOwnerAndYears.run(
          { ownerIds: [ownerId], years: [toYear] },
          client,
        );
        if (existing.length > 0) {
          throw new GraphQLError(
            `${toYear} already has ${existing.length} shareholder(s); replace them instead of copying from ${fromYear}`,
            { extensions: { code: 'SHAREHOLDERS_TARGET_YEAR_NOT_EMPTY' } },
          );
        }
        const copied = await copyShareholders.run({ ownerId, fromYear, toYear }, client);
        return copied.sort((a, b) =>
          a.sort_order === b.sort_order ? a.id.localeCompare(b.id) : a.sort_order - b.sort_order,
        );
      });
    } catch (error) {
      throw translateShareholdersWriteError(error, ownerId, toYear);
    } finally {
      this.clearCache();
    }
  }

  public clearCache() {
    this.getShareholdersByOwnerAndYearLoader.clearAll();
  }
}
