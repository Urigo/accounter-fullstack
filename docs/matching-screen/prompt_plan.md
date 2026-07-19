# Iterative Blueprint: Charge Matching Review Screen

After reviewing the spec, here is the iterative breakdown to ensure safe, test-driven progress
without massive complexity leaps at any stage.

## Phase 1: Backend Foundation (API & Core Logic)

1. **Schema Definition:** Define the new `chargesAwaitingMatchQueue` query, input filters, and
   response types in the GraphQL schema.
2. **On-the-fly Scoring Service:** Create an internal helper/service that takes an array of
   unmatched charges and calculates their matches on the fly (reusing the existing algorithm).
3. **Query Resolver Implementation:**
   - Implement the `BY_DATE` path: Fetch `limit` charges at the requested `offset`, map to the
     scoring service.
   - Implement the `BY_SCORE` path: Fetch `100` charges (the evaluation cap), map to the scoring
     service, sort by score descending, slice by `limit`/`offset`.
4. **Merge Validation:** Ensure the existing merge mutation provides the correct responses
   (success/errors) expected by the client.

## Phase 2: Frontend State & Scaffold

5. **Client GraphQL Definitions:** Write the `.graphql` operation files in the client to trigger
   `graphql-codegen`.
6. **Local State Management Hook:** Create a custom React hook (e.g., `useChargeMatchQueue`) to
   manage the array of charges, the current focused index, and the session "skipped" or "matched"
   status dictionary.

## Phase 3: Frontend Presentation (UI Layouts)

7. **Scaffold & Shell:** Create the main page route and structural grid (Header Top, Sidebar Left,
   Split View Center, Footer Bottom).
8. **Sidebar & Header:** Build the list of awaiting matches and the filter/sort controls.
9. **Comparison Views (`BaseCharge` and `SuggestedCharge`):** Build the core visual cards for the
   charges, complete with amount formatting, document thumbnails, and the expandable "extensions"
   panel.

## Phase 4: Integration & Interaction (Wiring)

10. **Alternative Suggestions Footer:** Build the list of alternative suggestions and wire it to
    dynamically update the `SuggestedCharge` view state.
11. **Action Handlers (Accept & Skip):** Wire the "Accept" button to the merge mutation endpoint
    (with error toast handling) and the "Skip" button to the local state hook. Ensure both actions
    advance the queue focus.

---

# Code-Generation Prompts

Below is the series of prompts designed for a code-generation LLM. They are strictly sequential, ask
for test-driven development (TDD), and ensure every newly created piece is integrated.

### Prompt 1: Backend Schema & Types

```text
You are an expert full-stack developer. We are building a "Charge Matching Review Screen" based on a specification.

Step 1: Define the GraphQL Schema.
Target package: `packages/server/src/modules/charges-matcher` (or the appropriate module based on your folder structure).

Task:
1. Extend the `charges-matcher.graphql.ts` schema to include a new query: `chargesAwaitingMatchQueue`.
2. It should accept inputs for: `limit` (Int), `offset` (Int), `businessId` (UUID), `fromDate` (String), `toDate` (String), `mode` (Enum: 'DOC_BASE' | 'TRANSACTION_BASE' — filters the queue by base-charge type), and `sortBy` (Enum: 'BY_DATE' | 'BY_SCORE').
3. It should return a paginated response type `ChargesAwaitingMatchResult` containing:
   - `baseCharges`: Array of a new type `ChargeWithSuggestions`.
   - `totalCount`: Int.
4. Define `ChargeWithSuggestions` to include a `baseCharge` (Type Charge) and `suggestions` (Array of the existing `ChargeMatch` type).

Instructions:
- Write the GraphQL schema definitions.
- Ensure the types are well documented with GraphQL comments.
- Do NOT implement the resolver yet. Stop after writing the schema and running any necessary codegen commands so we can verify the types.
```

### Prompt 2: Backend Match Calculation Logic (TDD)

```text
Step 2: Implement the core lazy-evaluation matcher logic.

Task:
We need a reusable backend function/service (e.g., `evaluateMatchesForCharges`) that takes an array of unmatched `Charge` entities and returns them mapped to their highest confidence suggestions.

Instructions:
1. First, write a Unit Test using Vitest (or your testing framework) in the server package. The test should mock the underlying scoring algorithm and verify that given 3 base charges, it returns an array of 3 `ChargeWithSuggestions` objects with accurately sorted suggestions.
2. Next, implement the function. It should map over the provided charges, call the underlying algorithm, and sort the suggestions by confidence.
3. Ensure no direct DB mutations occur here; it is purely read-only and analytical.
```

### Prompt 3: Backend Resolver Implementation (TDD)

```text
Step 3: Implement the `chargesAwaitingMatchQueue` resolver.

Task:
Implement the GraphQL resolver for the schema defined in Step 1, using the logical helper from Step 2.

Instructions:
1. Write Unit Tests for the resolver isolating the two sorting paths.
   - Path A (`BY_DATE`): Verify it fetches `limit` unused charges from the DB at the requested `offset` (i.e., the DB query applies both `limit` and `offset`, so subsequent pages return different rows) and passes them to the scoring helper.
   - Path B (`BY_SCORE`): Verify it forces a DB fetch limit of 100 recent unused charges (the evaluation cap), passes them to the scoring helper with bounded concurrency, sorts the entire 100-item array descending by the top suggestion's score, and THEN applies the `limit`/`offset` slice to return the page.
2. Implement the resolver securely, ensuring authentication and authorization (e.g., matching the user's access to the requested `businessId`).
3. Wire the resolver into the module's provider/index.
```

### Prompt 4: Client CodeGen & State Management Hook (TDD)

```text
Step 4: Client API layer and Local State Hook.
Target package: `packages/client`

Task:
We need to handle the queue state locally before building the UI.

Instructions:
1. Define the new `ChargesAwaitingMatchQueue` query operation in the client package to trigger `graphql-codegen`. Do NOT define a `MergeCharges` mutation — it already exists in `packages/client/src/hooks/use-merge-charges.ts` (exposed via the `useMergeCharges` hook), and redefining it would cause duplicate-operation errors during codegen. Reuse the existing hook.
2. Write a Unit Test for a custom React Hook called `useChargeMatchQueue`.
3. The hook test should assert:
   - It maintains an array of items.
   - Maintains an `activeIndex` tracking the currently viewed base charge.
   - Exposes a `skipItem(id)` method that flags an ID as skipped and increments `activeIndex`.
   - Exposes an `acceptItemStatus(id, success/fail)` method. On success, it flags as matched and increments index.
4. Implement the `useChargeMatchQueue` hook to satisfy these tests.
```

### Prompt 5: UI Scaffold, Header & Sidebar Component

```text
Step 5: Frontend Structural Layout.

Task:
Create the visual shell, the filtering header, and the sidebar utilizing `shadcn/ui` and Tailwind in the React client.

Instructions:
1. Build `ChargeMatchingHeader` with two distinct groups of controls:
   - Filters: a Mode/Type selector ("Doc Base" vs "Transaction Base"), a Date Range (timeframe) picker, and a Business select.
   - Sort toggle: "Date" vs "Match Score" (separate from the Mode/Type filter). Include a conditional alert banner if "Match Score" is selected: "Note: Score-based sorting currently evaluates only the 100 most recent unmatched charges."
2. Build `ChargeMatchingSidebar`: Accepts an array of charges and the state dictionary from our `useChargeMatchQueue` hook. It renders a vertical list. Items show a default icon, a "green check" for matched, and a "ghosted/gray" state for skipped.
3. Build the main page container `ChargeMatchingReviewScreen` importing the Header, Sidebar, and the GraphQL queries. Wire it so that selecting filters in the Header triggers a refetch of the GraphQL query.
```

### Prompt 6: Comparison Cards (Base & Suggestion views)

```text
Step 6: Build the Comparison View Components.

Task:
Create the visual components that display the intricate details of a charge for a side-by-side comparison.

Instructions:
1. Create a `ChargeDetailCard` component. It must accept a `Charge` object and optionally a `confidenceScore`.
2. Render: Date, Amount (using existing currency formatting utils), Counterparty, and Description.
3. If the charge has a document `image_url`, render an image thumbnail component.
4. Add an Expandable section (using an accordion or toggle) titled "More Details" that renders secondary transactions or mapped expenses.
5. In the `ChargeMatchingReviewScreen` container (from Step 5), import two instances of `ChargeDetailCard`. Use the active item from `useChargeMatchQueue`. Render the Base Charge on the left and the first/highest suggestion on the right.
```

### Prompt 7: Final Integration (Alternatives Footer & Actions)

```text
Step 7: Final Wiring, Action Handlers, and Footer.

Task:
Wire the accept/skip flows and the alternative suggestions.

Instructions:
1. Create an `AlternativeSuggestionsFooter` component. It renders a horizontal row of buttons for matches rank 2, 3, etc.
2. In the main Screen component, maintain a local state for `selectedSuggestionOverride`. By default, it's null (meaning use Rank 1). Clicking an item in the Footer updates this override, passing a different suggestion to the right-side `ChargeDetailCard`.
3. Implement the `handleSkip` function: Call the hook's skip method to advance the queue.
4. Implement the `handleAccept` function:
   - Call the existing `useMergeCharges` hook (`packages/client/src/hooks/use-merge-charges.ts`) to merge the charges.
   - Await the response.
   - If success: Fire a success Toast, and call the hook's success method to update the sidebar icon and advance the queue.
   - If error: Fire a descriptive error Toast. Do NOT advance the queue.
5. Ensure all pieces are cleanly exported and integrated into the app's routing.
```
