import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { resolveWriteTargetBusinessId } from '../../../shared/helpers/auth-scope.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import type {
  IGetShaam6111SettingsUpToYearQuery,
  IGetShaam6111SettingsUpToYearResult,
  IUpsertShaam6111SettingsQuery,
} from '../types.js';

const getShaam6111SettingsUpToYear = sql<IGetShaam6111SettingsUpToYearQuery>`
  SELECT *
  FROM accounter_schema.shaam6111_settings
  WHERE owner_id = $ownerId! AND year <= $year!
  ORDER BY year DESC;`;

const upsertShaam6111Settings = sql<IUpsertShaam6111SettingsQuery>`
  INSERT INTO accounter_schema.shaam6111_settings (owner_id, year, header, tax_adjustment_overrides)
  VALUES ($ownerId!, $year!, COALESCE($header, '{}'::jsonb), COALESCE($taxAdjustmentOverrides, '{}'::jsonb))
  ON CONFLICT (owner_id, year) DO UPDATE
    SET header = accounter_schema.shaam6111_settings.header || COALESCE($header, '{}'::jsonb),
        tax_adjustment_overrides = COALESCE(
          $taxAdjustmentOverrides,
          accounter_schema.shaam6111_settings.tax_adjustment_overrides
        )
  RETURNING *;`;

/**
 * Stored 6111 header fields: the GraphQL header enums and values. A field missing from a year is
 * taken from an earlier year; a field stored as `null` is explicitly unset for that year.
 */
export type Shaam6111HeaderSettings = Partial<{
  industryCode: string | null;
  businessDescription: string | null;
  businessType: string | null;
  reportingMethod: string | null;
  accountingMethod: string | null;
  accountingSystem: string | null;
  ifrsImplementationYear: string | null;
  ifrsReportingOption: string | null;
  softwareRegistrationNumber: string | null;
  isPartnership: boolean | null;
  partnershipCount: number | null;
  partnershipProfitShare: number | null;
  currencyType: string | null;
  amountsInThousands: boolean | null;
  auditOpinionType: string | null;
}>;

/** Manual tax-adjustment amounts, by line code */
export type Shaam6111TaxAdjustmentOverrides = Record<string, number>;

export type Shaam6111Settings = {
  header: Shaam6111HeaderSettings;
  taxAdjustmentOverrides: Shaam6111TaxAdjustmentOverrides;
};

/** Header fields that belong to a single year, and so are never carried over from an earlier one */
const YEARLY_HEADER_FIELDS: ReadonlySet<keyof Shaam6111HeaderSettings> = new Set([
  'auditOpinionType',
]);

/**
 * The settings in effect for a year: each header field from the latest year up to it that names
 * it (yearly fields only from the year itself), and that year's manual amounts. A year that stores
 * a field as `null` unsets it, so earlier years don't fill it in.
 */
export function effectiveShaam6111Settings(
  rows: readonly Pick<
    IGetShaam6111SettingsUpToYearResult,
    'year' | 'header' | 'tax_adjustment_overrides'
  >[],
  year: number,
): Shaam6111Settings {
  const header: Record<string, unknown> = {};
  for (const row of [...rows].sort((a, b) => b.year - a.year)) {
    for (const [key, value] of Object.entries((row.header ?? {}) as Shaam6111HeaderSettings)) {
      if (value === undefined || key in header) {
        continue;
      }
      if (row.year !== year && YEARLY_HEADER_FIELDS.has(key as keyof Shaam6111HeaderSettings)) {
        continue;
      }
      header[key] = value === '' ? null : value;
    }
  }
  // explicitly unset fields stop inheritance, but read as unset
  for (const [key, value] of Object.entries(header)) {
    if (value === null) {
      delete header[key];
    }
  }
  const yearRow = rows.find(row => row.year === year);
  return {
    header: header as Shaam6111HeaderSettings,
    taxAdjustmentOverrides: (yearRow?.tax_adjustment_overrides ??
      {}) as Shaam6111TaxAdjustmentOverrides,
  };
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class Shaam6111SettingsProvider {
  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
    private auditLogsProvider: AuditLogsProvider,
  ) {}

  public async getSettings(ownerId: string, year: number): Promise<Shaam6111Settings> {
    const rows = await getShaam6111SettingsUpToYear.run({ ownerId, year }, this.db);
    return effectiveShaam6111Settings(rows, year);
  }

  /**
   * Stores a year's header fields and/or manual amounts, and records the change in the audit log.
   * Header fields are merged into what the year already stores (a `null` unsets one); manual
   * amounts replace the year's set. Only the request's write-target business can be written.
   */
  public async updateSettings(params: {
    ownerId: string;
    year: number;
    header?: Shaam6111HeaderSettings | null;
    taxAdjustmentOverrides?: Shaam6111TaxAdjustmentOverrides | null;
  }): Promise<void> {
    const { ownerId, year, header, taxAdjustmentOverrides } = params;
    const authContext = await this.authContextProvider.getAuthContext();
    // RLS only lets the request write to its write-target business: fail clearly before trying
    const writeTargetId = authContext
      ? resolveWriteTargetBusinessId(authContext.tenant.businessId, authContext.activeReadScope)
      : null;
    if (ownerId !== writeTargetId) {
      throw new GraphQLError(
        "6111 settings can only be saved for the business you're working in; switch to it first",
        { extensions: { code: 'FORBIDDEN' } },
      );
    }
    await this.db.transaction(async client => {
      const before = await getShaam6111SettingsUpToYear
        .run({ ownerId, year }, client)
        .then(rows => rows.find(row => row.year === year));
      const [after] = await upsertShaam6111Settings.run(
        {
          ownerId,
          year,
          header: header ? JSON.stringify(header) : null,
          taxAdjustmentOverrides: taxAdjustmentOverrides
            ? JSON.stringify(taxAdjustmentOverrides)
            : null,
        },
        client,
      );
      await this.auditLogsProvider.log(
        {
          ownerId,
          userId: authContext?.user?.userId,
          auth0UserId: authContext?.user?.auth0UserId ?? undefined,
          action: 'SHAAM6111_SETTINGS_UPDATED',
          entity: 'Shaam6111Settings',
          entityId: `${ownerId}:${year}`,
          details: {
            year,
            before: before
              ? { header: before.header, taxAdjustmentOverrides: before.tax_adjustment_overrides }
              : null,
            after: {
              header: after?.header,
              taxAdjustmentOverrides: after?.tax_adjustment_overrides,
            },
          },
        },
        client,
      );
    });
  }
}
