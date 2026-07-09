import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Check, SkipForward } from 'lucide-react';
import { useQuery } from 'urql';
import {
  ChargeMatchCardFieldsFragmentDoc,
  ChargesAwaitingMatchQueueDocument,
  type ChargeMatchCardFieldsFragment,
  type ChargesAwaitingMatchQueueQuery,
} from '../../gql/graphql.js';
import { getFragmentData } from '../../gql/index.js';
import { useChargeMatchQueue } from '../../hooks/use-charge-match-queue.js';
import { useMergeCharges } from '../../hooks/use-merge-charges.js';
import { PageLayout } from '../layout/page-layout.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { Button } from '../ui/button.js';
import { Skeleton } from '../ui/skeleton.js';
import {
  AlternativeSuggestionsFooter,
  type FooterSuggestion,
} from './alternative-suggestions-footer.js';
import { ChargeDetailCard } from './charge-detail-card.js';
import {
  ChargeMatchingHeader,
  DEFAULT_CHARGE_MATCHING_FILTERS,
  type ChargeMatchingFilters,
} from './charge-matching-header.js';
import {
  ChargeMatchingSidebar,
  type ChargeMatchingSidebarItem,
} from './charge-matching-sidebar.js';
import { chargeDate, chargeTitle } from './utils.js';

export const QUEUE_PAGE_SIZE = 20;

type QueueEntry =
  ChargesAwaitingMatchQueueQuery['chargesAwaitingMatchQueue']['baseCharges'][number];

export type ChargeMatchQueueItem = {
  id: string;
  baseCharge: ChargeMatchCardFieldsFragment;
  suggestions: QueueEntry['suggestions'];
};

export const ChargeMatchingReviewScreen = (): ReactElement => {
  const [filters, setFilters] = useState<ChargeMatchingFilters>(DEFAULT_CHARGE_MATCHING_FILTERS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Changing any filter updates the variables, which triggers a refetch
  const [{ data, fetching, error }] = useQuery({
    query: ChargesAwaitingMatchQueueDocument,
    variables: {
      limit: QUEUE_PAGE_SIZE,
      offset: 0,
      businessId: filters.businessId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      mode: filters.mode,
      sortBy: filters.sortBy,
    },
  });

  const items: ChargeMatchQueueItem[] = useMemo(
    () =>
      (data?.chargesAwaitingMatchQueue.baseCharges ?? []).map(entry => {
        const baseCharge = getFragmentData(ChargeMatchCardFieldsFragmentDoc, entry.baseCharge);
        return { id: baseCharge.id, baseCharge, suggestions: entry.suggestions };
      }),
    [data],
  );

  const queue = useChargeMatchQueue(items);

  const sidebarItems: ChargeMatchingSidebarItem[] = useMemo(
    () =>
      items.map(item => ({
        id: item.id,
        title: chargeTitle(item.baseCharge),
        subtitle: chargeDate(item.baseCharge),
        amount: item.baseCharge.totalAmount?.formatted,
      })),
    [items],
  );

  const totalCount = data?.chargesAwaitingMatchQueue.totalCount ?? 0;
  const { activeItem } = queue;

  // Which suggestion is shown in the comparison view. Null means rank 1; the
  // override is keyed by item id, so advancing the queue naturally falls back
  // to the top suggestion of the next charge
  const [suggestionOverride, setSuggestionOverride] = useState<{
    itemId: string;
    index: number;
  } | null>(null);
  const selectedSuggestionIndex =
    suggestionOverride && suggestionOverride.itemId === activeItem?.id
      ? suggestionOverride.index
      : 0;
  const selectedSuggestion = activeItem?.suggestions[selectedSuggestionIndex];
  const selectedSuggestionCharge = selectedSuggestion
    ? getFragmentData(ChargeMatchCardFieldsFragmentDoc, selectedSuggestion.charge)
    : null;

  const footerSuggestions: FooterSuggestion[] = useMemo(
    () =>
      (activeItem?.suggestions ?? []).map(suggestion => ({
        chargeId: suggestion.chargeId,
        confidenceScore: suggestion.confidenceScore,
        label: chargeTitle(getFragmentData(ChargeMatchCardFieldsFragmentDoc, suggestion.charge)),
      })),
    [activeItem],
  );

  const { mergeCharges, fetching: merging } = useMergeCharges();

  const handleSkip = useCallback(() => {
    if (activeItem) {
      queue.skipItem(activeItem.id);
    }
  }, [activeItem, queue]);

  const handleAccept = useCallback(async () => {
    if (!activeItem || !selectedSuggestion) {
      return;
    }
    // useMergeCharges fires the success/error toasts and resolves to the
    // merged charge on success or undefined on failure. On failure the queue
    // does not advance, so the user can retry or deliberately skip
    const merged = await mergeCharges({
      baseChargeID: activeItem.id,
      chargeIdsToMerge: [selectedSuggestion.chargeId],
    });
    queue.acceptItemStatus(activeItem.id, !!merged);
  }, [activeItem, selectedSuggestion, mergeCharges, queue]);

  return (
    <PageLayout
      title="Charge Matching"
      description="Review and merge suggested charge matches, one by one."
    >
      <ChargeMatchingHeader filters={filters} onFiltersChange={setFilters} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load the matching queue</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {fetching ? (
        <div className="flex gap-4">
          <Skeleton className="h-96 w-72" />
          <Skeleton className="h-96 flex-1" />
        </div>
      ) : error ? null : (
        <div className="flex gap-4">
          <ChargeMatchingSidebar
            items={sidebarItems}
            statusById={queue.statusById}
            activeId={activeItem?.id ?? null}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed(collapsed => !collapsed)}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <p className="text-sm text-gray-500">
              Showing {items.length} of {totalCount} charges awaiting match
            </p>

            {/* Split comparison view: base charge on the left, top suggestion on the right */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeItem ? (
                <ChargeDetailCard charge={activeItem.baseCharge} title="Base Charge" />
              ) : (
                <section className="rounded-lg border p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-500">Base Charge</h3>
                  <p className="text-sm text-gray-500">
                    {items.length === 0 ? 'No charges awaiting match.' : 'Queue completed 🎉'}
                  </p>
                </section>
              )}
              {selectedSuggestionCharge ? (
                <ChargeDetailCard
                  charge={selectedSuggestionCharge}
                  title="Suggested Match"
                  confidenceScore={selectedSuggestion?.confidenceScore}
                />
              ) : (
                <section className="rounded-lg border p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-500">Suggested Match</h3>
                  <p className="text-sm text-gray-500">
                    {activeItem ? 'No suggestions for this charge.' : '—'}
                  </p>
                </section>
              )}
            </div>

            {activeItem && (
              <div className="flex items-center gap-2">
                <Button onClick={handleAccept} disabled={!selectedSuggestion || merging}>
                  <Check className="size-4" />
                  Accept
                </Button>
                <Button variant="outline" onClick={handleSkip} disabled={merging}>
                  <SkipForward className="size-4" />
                  Skip
                </Button>
              </div>
            )}

            <AlternativeSuggestionsFooter
              suggestions={footerSuggestions}
              selectedIndex={selectedSuggestionIndex}
              onSelect={index =>
                activeItem && setSuggestionOverride({ itemId: activeItem.id, index })
              }
            />
          </div>
        </div>
      )}
    </PageLayout>
  );
};
