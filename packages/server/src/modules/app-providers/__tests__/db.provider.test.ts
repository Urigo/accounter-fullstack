import { beforeEach, describe, expect, it, vi } from 'vitest';
import type postgres from 'pg';
import { DBProvider } from '../db.provider.js';

describe('DBProvider', () => {
  let mockQuery: ReturnType<typeof vi.fn<(queryText: string, values?: unknown[]) => Promise<postgres.QueryResult<postgres.QueryResultRow>>>>;
  let mockPool: postgres.Pool;
  let dbProvider: DBProvider;

  beforeEach(() => {
    // Create a properly typed mock query function
    mockQuery = vi.fn();

    // Create a mock pool with all required methods
    mockPool = {
      query: mockQuery,
      connect: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    } as unknown as postgres.Pool;

    dbProvider = new DBProvider(mockPool);
  });

  describe('constructor', () => {
    it('should initialize with pool', () => {
      expect(dbProvider.pool).toBe(mockPool);
    });

    it('should throw error if pool is missing in constructor', () => {
      expect(() => new DBProvider(null as unknown as postgres.Pool)).toThrow(
        'DBPoolProvider: Pool instance is required',
      );
    });
  });

  describe('query', () => {
    it('should execute query successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await dbProvider.query('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
      expect(result.rowCount).toBe(1);
    });

    it('should handle queries without parameters', async () => {
      const mockResult = {
        rows: [{ count: 5 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await dbProvider.query('SELECT COUNT(*) as count FROM test');

      expect(mockQuery).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM test', undefined);
      expect(result.rows[0].count).toBe(5);
    });

    it('should throw error if pool property is set to null', async () => {
      // We forcibly set pool to null to test runtime safety of query method
      // explicitly bypassing the constructor check we just verified
      (dbProvider as any).pool = null;

      await expect(dbProvider.query('SELECT 1')).rejects.toThrow(
        'DB connection not initialized',
      );
    });

    it('should normalize rowCount to 0 if null', async () => {
      const mockResult = {
        rows: [],
        rowCount: null,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await dbProvider.query('SELECT * FROM test WHERE false');

      expect(result.rowCount).toBe(0);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      await expect(dbProvider.query('SELECT 1')).rejects.toThrow('Database connection failed');
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is available', async () => {
      const mockResult = {
        rows: [{ health: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await dbProvider.healthCheck();

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1 as health');
      expect(result).toBe(true);
    });

    it('should return false when database query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Connection timeout'));

      const result = await dbProvider.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when result is unexpected', async () => {
      const mockResult = {
        rows: [{ health: 0 }], // Unexpected value
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await dbProvider.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when no rows returned', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await dbProvider.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should call pool.end()', async () => {
      await dbProvider.shutdown();
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should not throw if pool is missing', async () => {
      (dbProvider as any).pool = null;
      await expect(dbProvider.shutdown()).resolves.not.toThrow();
    });
  });
});
