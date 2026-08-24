import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useUpdateCharge } from '../../hooks/use-update-charge.js';
import { SimilarChargesByIdModal } from '../common/index.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { AbsentValue } from './charge-indicators.js';

export type SuggestedTag = { id: string; name: string; namePath?: string[] };

/** What the similar-charges follow-up matches on, once a suggestion has been applied. */
type SimilarCriteria = { description?: string; tagIds?: { id: string }[] };

/**
 * Shared behavior behind the description and tags fields: offer a server-suggested value inline,
 * apply it in one click, then offer to apply the same value to similar charges.
 *
 * Replaces the old `bg-yellow-400` block, which read as an error rather than an offer. A pending
 * suggestion is instead marked with a dashed amber underline — visible, but not alarming.
 */
function SuggestionAffordance({
  chargeId,
  label,
  onAccept,
  fetching,
  onChange,
  children,
}: {
  chargeId: string;
  /** Names the accept control for assistive tech, e.g. "Accept suggested description". */
  label: string;
  /**
   * Applies the suggestion. Resolves to the criteria the similar-charges follow-up should compare
   * against, or `null`/`undefined` if the mutation failed.
   */
  onAccept: () => Promise<SimilarCriteria | null | undefined>;
  /**
   * In-flight state of the caller's own `useUpdateCharge`. Passed down rather than read from a
   * second `useUpdateCharge()` here — each call is an independent `useMutation`, so a local one
   * would never observe the parent's mutation and the button would never disable.
   */
  fetching: boolean;
  onChange: () => void;
  children: ReactNode;
}): ReactElement {
  const [similarOpen, setSimilarOpen] = useState(false);
  /**
   * What the follow-up dialog compares against, captured at the moment it was applied (#4239).
   * Reading it off props instead would make the criteria vanish as soon as `onChange` refreshes the
   * record — the suggestion is gone once accepted — closing the dialog immediately.
   */
  const [applied, setApplied] = useState<SimilarCriteria | undefined>(undefined);

  const accept = useCallback(
    async (event: { stopPropagation: () => void }): Promise<void> => {
      event.stopPropagation();
      // Only proceed once the charge actually took the value — `updateCharge` resolves to `void` on
      // failure, having already toasted the error.
      const criteria = await onAccept();
      if (!criteria) {
        return;
      }
      // Refresh on the mutation itself, not on the dialog's close (#4239): hanging it off the
      // follow-up made the update invisible whenever that dialog resolved without closing.
      onChange();
      setApplied(criteria);
      setSimilarOpen(true);
    },
    [onAccept, onChange],
  );

  return (
    <>
      <span className="inline-flex items-baseline gap-1">
        <span className="border-b border-dashed border-amber-400 dark:border-amber-600">
          {children}
        </span>
        <Button
          variant="ghost"
          onClick={accept}
          disabled={fetching}
          aria-label={label}
          title={label}
          className="size-5 shrink-0 p-0 text-emerald-600 dark:text-emerald-400"
        >
          <Check className="size-3.5" />
        </Button>
      </span>

      <SimilarChargesByIdModal
        chargeId={chargeId}
        description={applied?.description}
        tagIds={applied?.tagIds}
        open={similarOpen}
        onOpenChange={setSimilarOpen}
      />
    </>
  );
}

export function ChargeDescriptionField({
  chargeId,
  value,
  suggestion,
  onChange,
}: {
  chargeId: string;
  value: string | undefined;
  suggestion: string | undefined;
  onChange: () => void;
}): ReactElement {
  const { updateCharge, fetching } = useUpdateCharge();
  const trimmed = value?.trim();

  const accept = useCallback(async () => {
    const value = suggestion!;
    const updated = await updateCharge({ chargeId, fields: { userDescription: value } });
    return updated ? { description: value } : null;
  }, [chargeId, suggestion, updateCharge]);

  if (trimmed) {
    return <span className="font-medium">{trimmed}</span>;
  }
  if (!suggestion) {
    return <AbsentValue>No description</AbsentValue>;
  }
  return (
    <SuggestionAffordance
      chargeId={chargeId}
      label={`Accept suggested description "${suggestion}"`}
      onAccept={accept}
      fetching={fetching}
      onChange={onChange}
    >
      <span className="font-medium text-amber-900 dark:text-amber-200">{suggestion}</span>
    </SuggestionAffordance>
  );
}

/** A tag chip. The `namePath` breadcrumb goes in the tooltip rather than inline — the record is three
 * lines tall, and a full `a > b > c >` prefix on every tag would dominate it. */
function TagChip({ tag }: { tag: SuggestedTag }): ReactElement {
  const path = tag.namePath?.length ? `${tag.namePath.join(' > ')} > ${tag.name}` : undefined;
  return (
    <Badge variant="secondary" title={path} className="font-normal">
      {tag.name}
    </Badge>
  );
}

export function ChargeTagsField({
  chargeId,
  tags,
  suggestedTags,
  onChange,
}: {
  chargeId: string;
  tags: readonly SuggestedTag[];
  suggestedTags: readonly SuggestedTag[];
  onChange: () => void;
}): ReactElement {
  const { updateCharge, fetching } = useUpdateCharge();

  const accept = useCallback(async () => {
    const tagIds = suggestedTags.map(tag => ({ id: tag.id }));
    const updated = await updateCharge({ chargeId, fields: { tags: tagIds } });
    return updated ? { tagIds } : null;
  }, [chargeId, suggestedTags, updateCharge]);

  if (tags.length > 0) {
    return (
      <span className="flex flex-wrap items-center gap-1">
        {tags.map(tag => (
          <TagChip key={tag.id} tag={tag} />
        ))}
      </span>
    );
  }
  if (suggestedTags.length === 0) {
    return <AbsentValue>No tags</AbsentValue>;
  }
  return (
    <SuggestionAffordance
      chargeId={chargeId}
      label={`Accept ${suggestedTags.length} suggested tag${suggestedTags.length === 1 ? '' : 's'}`}
      onAccept={accept}
      fetching={fetching}
      onChange={onChange}
    >
      <span className="flex flex-wrap items-center gap-1">
        {suggestedTags.map(tag => (
          <TagChip key={tag.id} tag={tag} />
        ))}
      </span>
    </SuggestionAffordance>
  );
}
