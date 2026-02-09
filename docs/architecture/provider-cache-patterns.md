# Provider Cache Patterns & Isolation Strategy

## Overview

In our multi-tenant architecture, ensuring data isolation between tenants is critical. Shared caches
in Singleton providers are a common source of data leakage, where data fetched by Tenant A becomes
accessible to Tenant B.

This document outlines the required patterns for caching to ensure security.

## The Golden Rules

1.  **Prefer `Scope.Operation`**: For any provider handling tenant-specific data, use
    `Scope.Operation`. This ensures a new instance is created for every GraphQL request, providing
    natural isolation.
2.  **Avoid Singletons with State**: Do not use `Scope.Singleton` if the provider stores any data
    (like a cache map) that varies by tenant.
3.  **DataLoaders are Caches**: Remember that `new DataLoader()` creates a cache. If you put a
    DataLoader in a Singleton, that cache is shared globally.

## Safe Patterns

### Pattern 1: Operation-Scoped Provider (Recommended)

Use this for almost all business logic providers (`BusinessesProvider`, `DocumentsProvider`, etc.).

```typescript
@Injectable({
  scope: Scope.Operation, // <--- CRITICAL
  global: true,
})
export class MyProvider {
  constructor(private db: TenantAwareDBClient) {}

  // DataLoader is created fresh for each request -> Safe
  public myLoader = new DataLoader(keys => this.batchLoad(keys));

  // Regular methods use the request-scoped DB client (RLS protected)
  public async getData() {
    return this.db.query(...);
  }
}
```

### Pattern 2: Singleton for static data (Advanced/Performance)

Only use this for:

- Static data (Countries, Currencies)
- High-read, low-write data where cross-tenant sharing is impossible (e.g. public info)

## Anti-Patterns (Vulnerabilities)

### ❌ Singleton with implicitly shared DataLoader

```typescript
@Injectable({ scope: Scope.Singleton })
export class UnsafeProvider {
  // DANGER: This loader is shared by ALL requests/tenants
  // If Tenant A loads ID=1, Tenant B can read ID=1 from cache
  loader = new DataLoader(...)
}
```

### ❌ Singleton with shared instance cache

```typescript
@Injectable({ scope: Scope.Singleton })
export class UnsafeProvider {
  cache = getCacheInstance(); // Shared global cache

  async getData() {
     // DANGER: Returns cached data regardless of who asks
     return this.cache.get(...);
  }
}
```

## Migration Checklist

When auditing providers:

1.  Check `@Injectable` scope.
2.  Look for `new DataLoader()`.
3.  Look for `getCacheInstance()` or `new Map()`.
4.  If Singleton + Cache + Tenant Data -> **Convert to Scope.Operation**.

## Testing Cache Isolation

Use the `cache-isolation.integration.test.ts` suite to verify that your provider is strictly scoped
per operation.

```typescript
it('should reflect Operation Scope by creating unique loader instances', () => {
  const instance1 = new MyProvider()
  const instance2 = new MyProvider()
  expect(instance1.loader).not.toBe(instance2.loader) // Must be different instances
})
```
