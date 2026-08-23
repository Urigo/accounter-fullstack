'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQuery } from 'urql';
import { SimilarChargesDocument } from '../../../../gql/graphql.js';
import { Dialog, DialogContent } from '../../../ui/dialog.js';
import { AccounterLoader } from '../../index.js';
import { SimilarChargesTable } from './similar-charges-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SimilarCharges(
    $chargeId: UUID!
    $withMissingTags: Boolean!
    $withMissingDescription: Boolean!
    $tagsDifferentThan: [String!]
    $descriptionDifferentThan: String
  ) {
    similarCharges(
      chargeId: $chargeId
      withMissingTags: $withMissingTags
      withMissingDescription: $withMissingDescription
      tagsDifferentThan: $tagsDifferentThan
      descriptionDifferentThan: $descriptionDifferentThan
    ) {
      id
      ...SimilarChargesTable
    }
  }
`;

export function SimilarChargesByIdModal({
  chargeId,
  tagIds,
  description,
  open,
  onOpenChange,
  onClose,
  showChargesWithExistingSuggestions = false,
}: {
  chargeId: string;
  tagIds?: { id: string }[];
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
  showChargesWithExistingSuggestions?: boolean;
}) {
  const [{ data, fetching }, fetchSimilarCharges] = useQuery({
    pause: true,
    query: SimilarChargesDocument,
    variables: {
      chargeId,
      withMissingTags: showChargesWithExistingSuggestions ? false : !!tagIds,
      withMissingDescription: showChargesWithExistingSuggestions ? false : !!description,
      tagsDifferentThan: showChargesWithExistingSuggestions
        ? tagIds
          ? tagIds.map(t => t.id)
          : undefined
        : undefined,
      descriptionDifferentThan: showChargesWithExistingSuggestions ? description : undefined,
    },
  });

  const hasCriteria = !!tagIds?.length || !!description;

  // `tagIds` is commonly rebuilt inline by the host (`suggestedTags.map(...)`), so its identity
  // changes on every render. Key the fetch on the criteria's *content* instead, or the effect below
  // would re-run — and re-query — on each render.
  const criteriaKey = useMemo(
    () =>
      JSON.stringify({
        tags: tagIds?.map(tag => tag.id) ?? null,
        description: description ?? null,
      }),
    [tagIds, description],
  );

  // Every close path — an explicit dismissal, "nothing similar to review", "no criteria to review"
  // — has to route through here. Closing via `onOpenChange` is what lets the host reopen the modal
  // for the *next* action; leaving its `open` latched at `true` made every later action a no-op,
  // since setting an already-`true` state changes nothing. `onClose` fires at most once per open so
  // the host's refresh isn't run several times for one action.
  const hasClosed = useRef(false);
  const close = useCallback(() => {
    if (hasClosed.current) {
      return;
    }
    hasClosed.current = true;
    onOpenChange(false);
    onClose?.();
  }, [onOpenChange, onClose]);

  // Declared before the fetch effect so a reopen clears the guard before anything can close again.
  useEffect(() => {
    if (open) {
      hasClosed.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!hasCriteria) {
      // Nothing to review — the mutation already landed, so just hand control back.
      close();
      return;
    }
    // `network-only`: the modal opens right after a charge was mutated, so a previous run's result
    // for the same criteria is stale by definition.
    fetchSimilarCharges({ requestPolicy: 'network-only' });
    // `criteriaKey` stands in for the unstable `tagIds`/`description` identities.
  }, [open, criteriaKey, hasCriteria, close, fetchSimilarCharges]);

  const onDialogChange = useCallback(
    (openState: boolean) => {
      if (openState) {
        onOpenChange(true);
        return;
      }
      close();
    },
    [onOpenChange, close],
  );

  // Nothing similar to review: close straight away so the host isn't left waiting on a dialog that
  // would never be shown.
  useEffect(() => {
    if (open && hasCriteria && !fetching && data?.similarCharges.length === 0) {
      close();
    }
  }, [open, hasCriteria, fetching, data, close]);

  // Always a boolean — a bare `data &&` here left it `undefined` before the query resolved, which
  // flipped the dialog between controlled and uncontrolled.
  const shouldShowModal = useMemo(
    () => !!(open && hasCriteria && data && data.similarCharges.length > 0),
    [open, hasCriteria, data],
  );

  return (
    <Dialog open={shouldShowModal} onOpenChange={onDialogChange}>
      <DialogContent
        className="overflow-scroll max-h-screen w-full sm:max-w-[640px] md:max-w-[768px] lg:max-w-[900px]"
        onClick={e => e.stopPropagation()}
      >
        <ErrorBoundary fallback={<div>Error fetching similar charges</div>}>
          {fetching ? (
            <AccounterLoader />
          ) : hasCriteria ? (
            <SimilarChargesTable
              data={data?.similarCharges ?? []}
              tagIds={tagIds}
              description={description}
              onOpenChange={onDialogChange}
            />
          ) : null}
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
