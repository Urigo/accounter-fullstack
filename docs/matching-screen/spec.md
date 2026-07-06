# Feature Specification: Charge Matching Review Screen

## 1. Overview

A new UI section designed to accelerate the bookkeeping workflow by pairing document-based charges
(e.g., invoices from email ingestion) with transaction-based charges (e.g., bank feed scraper). The
system leverages an existing confidence-scoring algorithm to surface the most likely matches,
allowing the user to rapidly accept or skip suggestions one-by-one.

## 2. Requirements & User Flow

- **Goal:** Enable quick verification and merging of algorithmic charge suggestions.
- **Scope:** Suggestion verification only. Manual search and linking of charges is out of scope for
  this specific UI.
- **Triage Loop Flow:**
  1. User reviews the side-by-side data of the Base Charge and the System Suggestion.
  2. If correct -> Clicks **"Accept"**.
  3. If incorrect -> Can click an alternative suggestion from the list to swap it into the
     suggestion view.
  4. If none are correct / no suggestions -> Clicks **"Skip"**.

## 3. Architecture & Data Handling

### 3.1 Backend (GraphQL API)

**New Query:** `chargesAwaitingMatchQueue` (Paginated)

- **Filters:** Business ID, Date Range (Timeframe), Mode/Type (e.g., "Doc Base" vs "Transaction
  Base").
- **Sorting Priorities:** `BY_DATE` (default) or `BY_SCORE`.
- **Lazy Evaluation & Performance constraints:**
  - The match scores should be calculated _on the fly_ to ensure fresh data.
  - **When sorting `BY_DATE`:** Fetch the requested page of unmatched base charges, then calculate
    their matches on the fly.
  - **When sorting `BY_SCORE`:** Fetch the 300 most recent unmatched base charges that match the
    filters. Calculate match scores for all 300 on the fly, sort them by top confidence score
    descending, and paginate _that_ derived list.
- **Data Contract:** Must return the base charge details (date, exact amount + currency symbol,
  counterparty, description, document `image_url` if applicable, additional nested
  transactions/docs), and an array of `suggestions` ordered by match score.

**Mutations:**

- Re-use or adapt the existing merge-charge mutation. It must confidently merge the matched charge
  into the base charge (or vice versa) and delete the duplicate.

### 3.2 Frontend (Client)

- **Framework Guidelines:** Follow existing React, `urql` GraphQL hooks, and `shadcn/ui` components
  based on repo rules.

#### UI Layout

**1. Top/Header Controls:**

- **Filters:** Mode/Type selector, Timeframe picker, Business select.
- **Sort Toggle:** "Date" vs. "Match Score".
- **Warning Note:** If "Sort by Score" is selected, dynamically render a text note/alert: _"Note:
  Score-based sorting currently evaluates only the 300 most recent unmatched charges."_

**2. Awaiting Matches Sidebar (Collapsible):**

- A vertical list of the current queue of base charges.
- Displays a session-based status indicator next to each:
  - `Pending` (default)
  - `Matched` (on successful merge)
  - `Skipped` (if user chose to skip)
- Includes a toggle to hide the sidebar to maximize matching view space.

**3. Main Comparison Area (Split View):**

- **Base Charge View (Left):**
  - Core Metadata: Event/Doc date, Amount (as-is formatted via standard app utilities) with Currency
    Symbol, Counterparty/Entity name, Document type (if applicable), and Description.
  - Thumbnail Viewer: Render the `image_url` for immediate visual validation.
  - Extension Panel (Expandable): An accordion or switch to reveal secondary details (extra
    transactions, misc expenses tied to the charge).
- **Current Suggestion View (Right):**
  - Displays the _top scoring_ automated suggestion.
  - Identical visual structure as the Base Charge View for 1:1 visual comparison.
  - Includes a "Match Confidence Score" indicator badge (e.g., 94%).
  - Includes matching Extension Panel.

**4. Alternative Suggestions Footer:**

- A list below the Current Suggestion showing rank 2, 3, etc., and their relative scores.
- Clicking one seamlessly replaces the content of the "Current Suggestion View" with the selected
  alternative.

## 4. Error Handling & State Transitions

- **On "Accept" Clicked:**
  1. Trigger merge mutation.
  2. **Success:** Mark item as "Matched" (green check) in the sidebar. System automatically advances
     the view to the next item in the pagination queue.
  3. **Failure:** Show an error toast notification. **Do not advance.** Retain the user on the exact
     same base charge to allow them to retry or deliberately skip.
- **On "Skip" Clicked:**
  1. Flag item as "Skipped" in local client state _for this session only_ (no backend persistence
     required for skipped state).
  2. Update sidebar queue icon.
  3. System automatically advances the view to the next base charge in the queue.

## 5. Testing Plan

### 5.1 Backend Tests

- **Unit Tests for Query Resolution:**
  - Verify `BY_DATE` pagination correctly lazy-loads scores only for the requested page limit.
  - Verify `BY_SCORE` pagination restricts initial fetch to the capped limit of 300, correctly sorts
    the highest scoring outputs, and handles pagination cleanly.
- **Integration Tests for Merging:**
  - Verify the mutation cleanly collapses two charges and properly assigns existing documents and
    transactions to the newly merged charge.

### 5.2 Frontend Tests

- **Render Core:** Verify amounts process the exact value string alongside appropriate currency
  symbols, rather than converting. Verify `image_url` handles null fallbacks gracefully without
  crashing.
- **State Behavior:**
  - Mock a success response for "Accept" and assert that the active focus steps to queue item N+1.
  - Mock a failure response for "Accept" and assert that active focus _remains_ on item N.
  - Assert "Skip" correctly assigns local skipped UI state and steps to item N+1.
