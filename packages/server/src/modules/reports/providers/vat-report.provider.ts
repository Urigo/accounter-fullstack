import DataLoader from 'dataloader';
import { format } from 'date-fns';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import {
  IGetReportByBusinessIdAndDatesQuery,
  IInsertReportParams,
  IInsertReportQuery,
  IUpdateReportParams,
  IUpdateReportQuery,
} from '../types.js';

const getReportByBusinessIdAndDates = sql<IGetReportByBusinessIdAndDatesQuery>`
SELECT *
FROM accounter_schema.pcn874
WHERE business_id = $businessId AND month_date IN $$monthDates;`;

const updateReport = sql<IUpdateReportQuery>`
  UPDATE accounter_schema.pcn874
  SET content = $content
  WHERE business_id = $businessId AND month_date = $monthDate
  RETURNING *;`;

const insertReport = sql<IInsertReportQuery>`
  INSERT INTO accounter_schema.pcn874 (business_id, month_date, content)
  VALUES ($businessId, $monthDate, $content)
  RETURNING *;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class VatReportProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchReportsByBusinessIdAndMonthDatesLoader(
    businessAndDates: readonly [string, string][],
  ) {
    const businessIdsMap = new Map<string, Set<string>>();
    businessAndDates.map(([businessId, monthDate]) => {
      if (businessIdsMap.has(businessId)) {
        businessIdsMap.get(businessId)?.add(monthDate);
      } else {
        businessIdsMap.set(businessId, new Set<string>([monthDate]));
      }
    });
    const reports = (
      await Promise.all(
        Array.from(businessIdsMap.entries()).map(async ([businessId, monthDates]) =>
          getReportByBusinessIdAndDates.run(
            { businessId, monthDates: Array.from(monthDates) },
            this.db,
          ),
        ),
      )
    ).flat();
    return businessAndDates.map(
      ([businessId, monthDate]) =>
        reports.find(
          report =>
            report.business_id === businessId &&
            format(report.month_date, 'yyyy-MM-dd') === monthDate,
        )?.content,
    );
  }

  public getReportByBusinessIdAndMonthDateLoader = new DataLoader(
    (businessAndDates: readonly [string, string][]) =>
      this.batchReportsByBusinessIdAndMonthDatesLoader(businessAndDates),
  );

  public async updateReport(params: IUpdateReportParams) {
    if (params.businessId && params.monthDate) {
      await this.invalidateByBusinessIdAndMonth(
        params.businessId,
        format(params.monthDate, 'yyyy-MM-dd'),
      );
    }
    return updateReport.run(params, this.db);
  }

  public async insertReport(params: IInsertReportParams) {
    if (params.businessId && params.monthDate) {
      await this.invalidateByBusinessIdAndMonth(
        params.businessId,
        format(params.monthDate, 'yyyy-MM-dd'),
      );
    }
    return insertReport.run(params, this.db);
  }

  public async invalidateByBusinessIdAndMonth(businessId: string, monthDate: string) {
    this.getReportByBusinessIdAndMonthDateLoader.clear([businessId, monthDate]);
  }

  public clearCache() {
    this.getReportByBusinessIdAndMonthDateLoader.clearAll();
  }
}
