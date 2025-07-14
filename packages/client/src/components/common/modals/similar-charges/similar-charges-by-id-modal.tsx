'use client';

import { useCallback, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    if (open && (tagIds || description)) {
      fetchSimilarCharges();
    }
  }, [open, tagIds, description, fetchSimilarCharges]);

  const onDialogChange = useCallback(
    (openState: boolean) => {
      onOpenChange(openState);
      if (open && !openState) {
        onClose?.();
      }
    },
    [onOpenChange, onClose, open],
  );

  const shouldShowModal = useMemo(() => {
    return open && (!!tagIds || !!description) && data && data?.similarCharges.length > 0;
  }, [open, tagIds, description, data]);

  return (
    <Dialog open={shouldShowModal} onOpenChange={onDialogChange}>
      <DialogContent
        className="overflow-scroll max-h-screen w-full sm:max-w-[640px] md:max-w-[768px] lg:max-w-[900px]"
        onClick={e => e.stopPropagation()}
      >
        <ErrorBoundary fallback={<div>Error fetching similar charges</div>}>
          {fetching ? (
            <AccounterLoader />
          ) : tagIds || description ? (
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
