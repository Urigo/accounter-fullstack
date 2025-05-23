/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Scope } from 'graphql-modules';
import postgres, { type QueryResultBase, type QueryResultRow } from 'pg';
import 'reflect-metadata';

type TypedQueryResult<Entity> = QueryResultBase & { rows: Entity[]; rowCount: number }; // NOTE: rowCount added to workaround pgTyped issue

@Injectable({
  scope: Scope.Singleton,
})
export class DBProvider {
  constructor(private pool: postgres.Pool) {}

  public async query<Entity extends QueryResultRow>(
    queryStatement: string,
    values?: any[] | undefined,
  ): Promise<TypedQueryResult<Entity>> {
    if (!this.pool) {
      throw new Error('DB connection not initialized');
    }
    return this.pool
      .query(queryStatement, values)
      .then(result => ({ ...result, rowCount: result.rowCount ?? 0 }));
  }
}
