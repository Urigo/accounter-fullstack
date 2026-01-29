import { describe, it, expect, vi } from 'vitest';
import { createApplication, createModule, Injectable, Scope, gql, Inject } from 'graphql-modules';
import { TenantAwareDBClient } from '../tenant-db-client.js';
import { DBProvider } from '../db.provider.js';
import { AUTH_CONTEXT } from '../../../shared/tokens.js';

describe('TenantAwareDBClient DI Integration', () => {
  it('should be injectable into providers and operation-scoped', async () => {
    // 1. Setup Mocks
    const mockPool = { 
        connect: vi.fn(), 
        query: vi.fn(), 
        end: vi.fn(), 
        on: vi.fn() 
    };
    
    @Injectable()
    class MockDBProvider {
        pool = mockPool;
    }

    // 2. Create Test Provider
    @Injectable({ scope: Scope.Operation })
    class TestProvider {
      constructor(@Inject(TenantAwareDBClient) public db: TenantAwareDBClient) {}
    }

    // 3. Create Module
    const testModule = createModule({
      id: 'test-module',
      typeDefs: gql`
        type Query {
          test: String
        }
      `
    });

    // 4. Create App
    const app = createApplication({
      modules: [testModule],
      providers: [
        TestProvider,
        TenantAwareDBClient,
        { provide: DBProvider, useClass: MockDBProvider },
        { 
            provide: AUTH_CONTEXT, 
            useValue: { authType: 'jwt', tenant: { businessId: '123' } }, 
            scope: Scope.Operation 
        }
      ]
    });

    // 5. Verify Injection & Scope
    const controller1 = app.createOperationController({ context: {} });
    const service1 = controller1.injector.get(TestProvider);
    
    expect(service1).toBeDefined();
    expect(service1.db).toBeInstanceOf(TenantAwareDBClient);

    const controller2 = app.createOperationController({ context: {} });
    const service2 = controller2.injector.get(TestProvider);

    // Verify different instances (Operation Scope)
    expect(service1).not.toBe(service2);
    expect(service1.db).not.toBe(service2.db);
    
    // Verify they are disposed
    await controller1.destroy(); 
    await controller2.destroy(); 
  });

  it('should throw error when auth context is null during query', async () => {
     const mockPool = { connect: vi.fn() };
     @Injectable()
     class MockDBProvider { pool = mockPool; }

     const testModule = createModule({
      id: 'test-module-fail',
      typeDefs: gql`
        type Query {
          test: String
        }
      `
    });
    
    const app = createApplication({ 
        modules: [testModule],
        providers: [
            TenantAwareDBClient,
            { provide: DBProvider, useClass: MockDBProvider },
            { provide: AUTH_CONTEXT, useValue: null, scope: Scope.Operation }
        ]
    });
    
    const controller = app.createOperationController({ context: {} });
    const dbClient = controller.injector.get(TenantAwareDBClient);
    
    await expect(dbClient.query('SELECT 1')).rejects.toThrow('Auth context not available. TenantAwareDBClient requires active authentication.');
  });
});
