# Navigation Enhancement Plan - Phase 1

## Overview

This document outlines the detailed plan for migrating the Accounter client application from
JSX-based routing to React Router v7's modern data router pattern with object-based route
configuration.

## Current State (✅ Completed)

### Quick Wins Implemented

- ✅ **Type-Safe Route Constants** - Centralized route definitions in `src/router/routes.ts`
- ✅ **Navigation Loading States** - Top progress bar during route transitions
- ✅ **Enhanced Error Boundaries** - Comprehensive error handling for all HTTP status codes
- ✅ **Improved Developer Experience** - Autocomplete, compile-time validation, single source of
  truth

### Current Architecture

```
index.tsx
└── RouterProvider (createBrowserRouter)
    └── Providers (AuthGuard, UrqlProvider, etc.)
        └── App (JSX Routes)
            ├── Route: /charges
            ├── Route: /businesses
            ├── Route: /reports
            └── ... (40+ routes defined as JSX)
```

**Issues:**

- JSX route definitions scattered across components
- No route-based code splitting
- No data loader/action patterns
- Auth checks happen after component render
- No type safety for route parameters
- Missing route metadata (titles, breadcrumbs, etc.)

---

## Phase 1: Modern Router Architecture

### Goals

1. Migrate to object-based route configuration
2. Implement route-based code splitting
3. Add data loaders for prefetching
4. Implement proper Suspense boundaries
5. Add route metadata and handles
6. Improve type safety for params

### Timeline: 3-5 days

- **Day 1**: Route configuration migration
- **Day 2**: Code splitting and lazy loading
- **Day 3**: Data loaders and actions
- **Day 4**: Suspense and loading states
- **Day 5**: Testing and refinement

---

## Step-by-Step Implementation

### Step 1: Create Route Configuration Structure

**New Files:**

```
src/router/
├── routes.ts (existing - already created)
├── config.tsx (new - route definitions)
├── loaders/
│   ├── charge-loader.ts
│   ├── business-loader.ts
│   ├── report-loader.ts
│   └── index.ts
└── layouts/
    ├── root-layout.tsx
    ├── dashboard-layout.tsx
    └── auth-layout.tsx
```

**Purpose:**

- Separate routing logic from component rendering
- Enable better code organization
- Support future route generators/validators

---

### Step 2: Define Object-Based Routes

**File: `src/router/config.tsx`**

```typescript
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ROUTES } from './routes.js';
import { ErrorBoundary } from '../components/error-boundary.js';
import { RootLayout } from './layouts/root-layout.js';
import { requireAuth } from './loaders/auth-loader.js';

// Lazy load components
const AllCharges = lazy(() => import('../components/screens/charges/all-charges'));
const Charge = lazy(() => import('../components/screens/charges/charge'));
const Businesses = lazy(() => import('../components/businesses'));
// ... more lazy imports

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        // Auth-protected routes
        path: '/',
        loader: requireAuth,
        errorElement: <ErrorBoundary />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AllCharges />
              </Suspense>
            ),
            handle: {
              title: 'All Charges',
              breadcrumb: 'Charges',
            },
          },
          {
            path: ROUTES.CHARGES.ROOT,
            handle: { breadcrumb: 'Charges' },
            children: [
              {
                index: true,
                element: <AllCharges />,
                handle: { title: 'All Charges' }
              },
              {
                path: 'missing-info',
                element: <MissingInfoCharges />,
                handle: { title: 'Missing Info Charges' }
              },
              {
                path: ':chargeId',
                loader: chargeLoader,
                element: <Charge />,
                handle: {
                  title: (data) => `Charge #${data.charge.id}`,
                  breadcrumb: (data) => data.charge.name
                }
              },
            ],
          },
          // ... more routes
        ],
      },
      {
        // Public routes
        path: ROUTES.LOGIN,
        element: <LoginPage />,
        handle: { title: 'Login' },
      },
    ],
  },
];
```

**Benefits:**

- ✅ Cleaner structure
- ✅ Better organization by feature
- ✅ Supports nested layouts
- ✅ Enables route-level data loading
- ✅ Supports route metadata via `handle`

---

### Step 3: Implement Route-Based Code Splitting

**Strategy:**

- Split by feature area (charges, businesses, reports)
- Split large report components individually
- Keep common components in main bundle

**Example Implementation:**

```typescript
// Option 1: Standard lazy loading
const TaxReport = lazy(() => import('../components/reports/tax-report'));

// Option 2: Named exports with lazy
const ProfitAndLossRoute = {
  path: ROUTES.REPORTS.PROFIT_AND_LOSS(),
  lazy: async () => {
    const { ProfitAndLossReport } = await import(
      '../components/reports/profit-and-loss-report'
    );
    return {
      Component: ProfitAndLossReport,
      loader: profitAndLossLoader,
    };
  },
  handle: {
    title: 'Profit & Loss Report',
    breadcrumb: 'P&L',
  },
};

// Option 3: Preload on hover (bonus)
const ChargeLink = ({ chargeId }) => {
  const preload = () => {
    import('../components/screens/charges/charge');
  };

  return (
    <Link
      to={ROUTES.CHARGES.DETAIL(chargeId)}
      onMouseEnter={preload}
    >
      View Charge
    </Link>
  );
};
```

**Expected Bundle Splits:**

- `main.js` - ~800KB (core app, layout, common components)
- `charges.js` - ~200KB (charges feature)
- `businesses.js` - ~150KB (businesses feature)
- `reports.js` - ~300KB (base reports)
- `tax-report.js` - ~100KB (tax report)
- `corporate-tax.js` - ~120KB (corporate tax report)
- ... individual report chunks

**Total reduction:** ~40-50% initial load

---

### Step 4: Implement Data Loaders

**Purpose:**

- Prefetch data before rendering
- Better loading states
- Avoid waterfalls
- Enable optimistic UI

**File: `src/router/loaders/charge-loader.ts`**

```typescript
import { redirect } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { getUrqlClient } from '../../lib/urql-client.js';
import { ChargeDocument } from '../../gql/graphql.js';
import { ROUTES } from '../routes.js';

export async function chargeLoader({ params }: LoaderFunctionArgs) {
  const { chargeId } = params;

  if (!chargeId) {
    throw redirect(ROUTES.CHARGES.ALL);
  }

  const client = getUrqlClient();

  try {
    const result = await client.query(ChargeDocument, {
      chargeId
    }).toPromise();

    if (result.error) {
      console.error('Failed to load charge:', result.error);
      throw new Response('Failed to load charge', { status: 500 });
    }

    if (!result.data?.charge) {
      throw new Response('Charge not found', { status: 404 });
    }

    return result.data;
  } catch (error) {
    console.error('Loader error:', error);
    throw new Response('An error occurred', { status: 500 });
  }
}

// Usage in component
export function Charge() {
  const data = useLoaderData<typeof chargeLoader>();
  // data is already loaded, no need for useQuery!

  return <ChargeDetails charge={data.charge} />;
}
```

**Loaders to Implement:**

- `auth-loader.ts` - Check authentication
- `charge-loader.ts` - Load charge data
- `business-loader.ts` - Load business data
- `business-trip-loader.ts` - Load trip data
- `report-loaders/` - Tax report, P&L, VAT, etc.

**Benefits:**

- ✅ Data loads in parallel with route transition
- ✅ No flash of loading state
- ✅ Errors handled before component renders
- ✅ Can redirect before rendering
- ✅ Type-safe data in components

---

### Step 5: Implement Actions for Mutations

**File: `src/router/actions/charge-actions.ts`**

```typescript
import { redirect } from 'react-router-dom';
import type { ActionFunctionArgs } from 'react-router-dom';
import { getUrqlClient } from '../../lib/urql-client.js';
import { UpdateChargeMutation } from '../../gql/graphql.js';
import { ROUTES } from '../routes.js';

export async function updateChargeAction({ request, params }: ActionFunctionArgs) {
  const { chargeId } = params;
  const formData = await request.formData();

  const client = getUrqlClient();
  const result = await client.mutation(UpdateChargeMutation, {
    chargeId,
    input: Object.fromEntries(formData),
  }).toPromise();

  if (result.error) {
    return { error: result.error.message };
  }

  // Redirect on success
  return redirect(ROUTES.CHARGES.DETAIL(chargeId));
}

// Usage in component
export function EditChargeForm() {
  const navigation = useNavigation();
  const actionData = useActionData<typeof updateChargeAction>();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Form method="post">
      {/* form fields */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
      {actionData?.error && <ErrorMessage>{actionData.error}</ErrorMessage>}
    </Form>
  );
}
```

**Actions to Consider:**

- Update charge
- Delete charge
- Create business trip
- Generate report
- Issue document

---

### Step 6: Add Suspense Boundaries

**Strategy:**

- Page-level Suspense for route transitions
- Component-level Suspense for deferred data
- Skeleton screens matching actual content

**File: `src/components/layout/page-suspense.tsx`**

```typescript
import { Suspense } from 'react';
import { Await, defer } from 'react-router-dom';
import { Skeleton } from '../ui/skeleton.js';

export function PageSuspense({ children }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {children}
    </Suspense>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-12 w-64" /> {/* Title */}
      <Skeleton className="h-32 w-full" /> {/* Content */}
      <Skeleton className="h-64 w-full" /> {/* Table */}
    </div>
  );
}

// Component-level deferred data
export function TaxReport() {
  const { reportData } = useLoaderData();

  return (
    <div>
      <h1>Tax Report</h1>
      <Suspense fallback={<ReportSkeleton />}>
        <Await resolve={reportData}>
          {(data) => <TaxReportTable data={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

---

### Step 7: Add Route Metadata with Handles

**Purpose:**

- Page titles
- Breadcrumb navigation
- Route-specific configuration
- Analytics tracking

**Implementation:**

```typescript
// In route config
{
  path: ROUTES.REPORTS.TAX(),
  loader: taxReportLoader,
  element: <TaxReport />,
  handle: {
    title: (data) => `Tax Report ${data?.year || ''}`,
    breadcrumb: (data) => data?.year || 'Tax Report',
    icon: <ParkingMeter />,
    description: 'Annual tax calculation report',
    requiresPermission: 'reports.view',
    analytics: {
      category: 'Reports',
      action: 'View Tax Report',
    },
  },
}

// Component to consume handles
export function Breadcrumbs() {
  const matches = useMatches();

  const crumbs = matches
    .filter((match) => match.handle?.breadcrumb)
    .map((match) => ({
      title: typeof match.handle.breadcrumb === 'function'
        ? match.handle.breadcrumb(match.data)
        : match.handle.breadcrumb,
      path: match.pathname,
    }));

  return (
    <nav>
      {crumbs.map((crumb, i) => (
        <span key={i}>
          {i > 0 && ' / '}
          <Link to={crumb.path}>{crumb.title}</Link>
        </span>
      ))}
    </nav>
  );
}

// Document title updater
export function DocumentTitle() {
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];

  useEffect(() => {
    const handle = lastMatch?.handle;
    if (handle?.title) {
      const title = typeof handle.title === 'function'
        ? handle.title(lastMatch.data)
        : handle.title;
      document.title = `${title} - Accounter`;
    }
  }, [lastMatch]);

  return null;
}
```

---

### Step 8: Implement Type-Safe Route Parameters

**File: `src/router/types.ts`**

```typescript
import type { LoaderFunctionArgs, Params } from 'react-router-dom';

// Define param types for each route
export interface ChargeParams extends Params {
  chargeId: string;
}

export interface BusinessParams extends Params {
  businessId: string;
}

export interface ReportParams extends Params {
  year?: string;
}

// Type-safe loader args
export type ChargeLoaderArgs = LoaderFunctionArgs<ChargeParams>;
export type BusinessLoaderArgs = LoaderFunctionArgs<BusinessParams>;
export type ReportLoaderArgs = LoaderFunctionArgs<ReportParams>;

// Helper to parse and validate params
export function validateChargeParams(params: Params): ChargeParams {
  if (!params.chargeId) {
    throw new Response('Charge ID is required', { status: 400 });
  }
  return params as ChargeParams;
}

// Usage in loader
export async function chargeLoader({ params }: ChargeLoaderArgs) {
  const { chargeId } = validateChargeParams(params);
  // chargeId is guaranteed to be a string here
  // ...
}
```

---

### Step 9: Create Layout Components

**File: `src/router/layouts/root-layout.tsx`**

```typescript
import { Outlet } from 'react-router-dom';
import { Providers } from '../../providers/index.js';
import { DocumentTitle } from '../components/document-title.js';
import { NavigationProgress } from '../../components/layout/navigation-progress.js';

export function RootLayout() {
  return (
    <Providers>
      <DocumentTitle />
      <NavigationProgress />
      <Outlet />
    </Providers>
  );
}
```

**File: `src/router/layouts/dashboard-layout.tsx`**

```typescript
import { Outlet } from 'react-router-dom';
import { DashboardLayout as DashboardUI } from '../../components/layout/dashboard-layout.js';

export function DashboardLayoutRoute() {
  return (
    <DashboardUI>
      <Outlet />
    </DashboardUI>
  );
}
```

---

### Step 10: Update index.tsx

**Before:**

```typescript
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="*" element={<Providers><App /></Providers>} />
  )
);
```

**After:**

```typescript
import { routes } from './router/config.js';

const router = createBrowserRouter(routes);

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
```

**Benefits:**

- ✅ Cleaner entry point
- ✅ All routing logic in one place
- ✅ Easier to test
- ✅ Better type inference

---

## Migration Strategy

### Phase 1A: Foundation (Day 1)

1. ✅ Create directory structure
2. ✅ Create layout components
3. ✅ Define base route structure
4. ✅ Migrate 5-10 simple routes
5. ✅ Test that basic navigation works

### Phase 1B: Core Routes (Day 2)

1. ✅ Migrate all charge routes
2. ✅ Migrate all business routes
3. ✅ Add code splitting to these routes
4. ✅ Test thoroughly

### Phase 1C: Reports (Day 3)

1. ✅ Migrate all report routes
2. ✅ Add individual code splits
3. ✅ Test report loading

### Phase 1D: Data Loading (Day 4)

1. ✅ Implement auth loader
2. ✅ Implement charge loader
3. ✅ Implement 2-3 report loaders
4. ✅ Update components to use loaders

### Phase 1E: Polish (Day 5)

1. ✅ Add all route handles
2. ✅ Implement breadcrumbs
3. ✅ Add document titles
4. ✅ Test complete flow
5. ✅ Performance audit

---

## Testing Plan

### Manual Testing

- [ ] All routes load correctly
- [ ] Auth redirect works
- [ ] Loading states appear
- [ ] Error boundaries catch errors
- [ ] Navigation is smooth
- [ ] Back button works
- [ ] Deep links work

### Automated Testing

```typescript
// Example route test
describe('Charge Routes', () => {
  it('loads charge detail', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: [ROUTES.CHARGES.DETAIL('123')],
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText('Charge #123')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users', async () => {
    mockAuthService.isLoggedIn = () => false;

    const router = createMemoryRouter(routes, {
      initialEntries: [ROUTES.CHARGES.ALL],
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    });
  });
});
```

---

## Performance Goals

### Initial Load

- **Before**: 2.5MB, 4.2s (3G)
- **Target**: 1.2MB, 2.1s (3G)
- **Improvement**: 52% smaller, 50% faster

### Route Transitions

- **Before**: 200ms (full page)
- **Target**: 50ms (instant with preloaded data)
- **Improvement**: 75% faster

### Code Splitting

- **Chunks**: 15-20 async chunks
- **Largest chunk**: <300KB
- **Common chunk**: ~800KB

---

## Rollback Plan

If issues arise:

1. **Feature flag**: Add flag to toggle new router

```typescript
const USE_NEW_ROUTER = import.meta.env.VITE_NEW_ROUTER === 'true';
const router = USE_NEW_ROUTER ? newRouter : legacyRouter;
```

2. **Gradual rollout**: Migrate routes one section at a time

3. **A/B testing**: Deploy to 10% of users first

4. **Monitoring**: Track errors, performance, user behavior

---

## Success Metrics

### Developer Experience

- ✅ Routes defined in one place
- ✅ Type-safe parameters
- ✅ Easy to add new routes
- ✅ Clear error messages
- ✅ Better testing

### User Experience

- ✅ Faster initial load
- ✅ Instant navigation
- ✅ Better loading states
- ✅ Clear error pages
- ✅ Proper back button behavior

### Performance

- ✅ 50% smaller initial bundle
- ✅ 75% faster navigation
- ✅ Better Lighthouse score (90+)
- ✅ Lower time to interactive

---

## Future Enhancements (Post Phase 1)

### Phase 2: Advanced Features

- [ ] Route-based permissions
- [ ] Optimistic UI updates
- [ ] Route prefetching on hover
- [ ] Parallel data loading
- [ ] Route-based analytics

### Phase 3: Developer Tools

- [ ] Route visualizer
- [ ] Route generator CLI
- [ ] Automatic route documentation
- [ ] Route performance dashboard

### Phase 4: Advanced Patterns

- [ ] Scroll restoration
- [ ] Focus management
- [ ] View transitions API
- [ ] Route-based state management
- [ ] Streaming SSR (if applicable)

---

## Resources

### React Router v7 Docs

- [Data Router Guide](https://reactrouter.com/en/main/routers/create-browser-router)
- [Loader Documentation](https://reactrouter.com/en/main/route/loader)
- [Action Documentation](https://reactrouter.com/en/main/route/action)
- [Error Handling](https://reactrouter.com/en/main/route/error-element)

### Code Examples

- [Remix Examples](https://remix.run/examples) (uses React Router v7)
- [React Router Examples](https://github.com/remix-run/react-router/tree/main/examples)

### Related PRs (Reference)

- Quick Wins #3: Route Constants
- Quick Wins #4: Loading States
- Phase 1: This implementation

---

## Questions & Decisions

### Q: Should we use `loader` for all data fetching?

**A:** Start with critical path data (charge details, business data). Keep using hooks for
optional/background data.

### Q: What about the existing URQL queries?

**A:** Keep them! Loaders can call URQL. Gradually migrate to loaders for route-level data, keep
hooks for component-level data.

### Q: How to handle the FiltersContext?

**A:** Continue using context. Loaders can read/write to context via URL search params.

### Q: Breaking changes for other developers?

**A:** Minimal. Components mostly stay the same. Only `App.tsx` routing changes significantly.

---

## Sign-off Checklist

Before proceeding with Phase 1:

- [x] Quick Wins #3 completed
- [x] Quick Wins #4 completed
- [ ] All developers reviewed plan
- [ ] Backup/branch created
- [ ] CI/CD pipeline ready
- [ ] Monitoring in place
- [ ] Rollback plan tested
- [ ] Go/No-Go decision made

---

## Appendix A: Complete Route Structure

```
/
├── / (home - redirects to charges)
├── /login
├── /network-error
├── /charges
│   ├── / (all charges)
│   ├── /missing-info
│   ├── /ledger-validation
│   └── /:chargeId
├── /businesses
│   ├── / (all businesses)
│   ├── /transactions (summary)
│   ├── /:businessId
│   └── /:businessId/transactions
├── /business-trips
│   ├── / (all trips)
│   └── /:businessTripId
├── /charts
│   ├── / (main)
│   └── /monthly-income-expense
├── /documents
│   ├── / (all documents)
│   ├── /issue-document
│   └── /issue-documents
├── /reports
│   ├── /trial-balance
│   ├── /conto
│   ├── /vat-monthly
│   ├── /profit-and-loss/:year?
│   ├── /tax/:year?
│   ├── /depreciation
│   ├── /shaam6111
│   ├── /yearly-ledger
│   ├── /corporate-tax-ruling-compliance/:year?
│   ├── /balance
│   └── /validate-reports
├── /accountant-approvals
├── /salaries
├── /tags
├── /tax-categories
└── /sort-codes
```

**Total Routes**: ~45 routes across 10 major sections

---

**Status**: Ready for implementation **Next Step**: Create PR for Phase 1A (Foundation) **Estimated
Completion**: 3-5 days
