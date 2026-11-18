import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
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
    SET header = COALESCE($header, accounter_schema.shaam6111_settings.header),
        tax_adjustment_overrides = COALESCE(
          $taxAdjustmentOverrides,
          accounter_schema.shaam6111_settings.tax_adjustment_overrides
        )
  RETURNING *;`;

/** Stored 6111 header fields: the GraphQL header enums and values, all optional */
export type Shaam6111HeaderSettings = Partial<{
  industryCode: string;
  businessDescription: string;
  businessType: string;
  reportingMethod: string;
  accountingMethod: string;
  accountingSystem: string;
  ifrsImplementationYear: string;
  ifrsReportingOption: string;
  softwareRegistrationNumber: string;
  isPartnership: boolean;
  partnershipCount: number;
  partnershipProfitShare: number;
  currencyType: string;
  amountsInThousands: boolean;
  auditOpinionType: string;
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
 * The settings in effect for a year: each header field from the latest year up to it that sets
 * it (yearly fields only from the year itself), and that year's manual amounts.
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
      if (value == null || value === '' || key in header) {
        continue;
      }
      if (row.year !== year && YEARLY_HEADER_FIELDS.has(key as keyof Shaam6111HeaderSettings)) {
        continue;
      }
      header[key] = value;
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
   * Stores a year's header fields and/or manual amounts (each replaces what the year had, when
   * given), and records the change in the audit log.
   */
  public async updateSettings(params: {
    ownerId: string;
    year: number;
    header?: Shaam6111HeaderSettings | null;
    taxAdjustmentOverrides?: Shaam6111TaxAdjustmentOverrides | null;
  }): Promise<void> {
    const { ownerId, year, header, taxAdjustmentOverrides } = params;
    const authContext = await this.authContextProvider.getAuthContext();
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
