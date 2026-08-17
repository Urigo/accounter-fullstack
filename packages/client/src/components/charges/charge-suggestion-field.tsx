import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useUpdateCharge } from '../../hooks/use-update-charge.js';
import { SimilarChargesByIdModal } from '../common/index.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';

export type SuggestedTag = { id: string; name: string; namePath?: string[] };

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
  similar,
  onChange,
  children,
}: {
  chargeId: string;
  /** Names the accept control for assistive tech, e.g. "Accept suggested description". */
  label: string;
  onAccept: () => Promise<unknown>;
  /**
   * In-flight state of the caller's own `useUpdateCharge`. Passed down rather than read from a
   * second `useUpdateCharge()` here — each call is an independent `useMutation`, so a local one
   * would never observe the parent's mutation and the button would never disable.
   */
  fetching: boolean;
  /** Which follow-up "apply to similar charges" question to ask once the value is applied. */
  similar: { description?: string; tagIds?: { id: string }[] };
  onChange: () => void;
  children: ReactNode;
}): ReactElement {
  const [similarOpen, setSimilarOpen] = useState(false);

  const accept = useCallback(
    async (event: { stopPropagation: () => void }): Promise<void> => {
      event.stopPropagation();
      // Only offer to propagate to similar charges once this charge actually took the value —
      // `updateCharge` resolves to `void` on failure (it has already toasted the error).
      const applied = await onAccept();
      if (applied) {
        setSimilarOpen(true);
      }
    },
    [onAccept],
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
        description={similar.description}
        tagIds={similar.tagIds}
        open={similarOpen}
        onOpenChange={setSimilarOpen}
        onClose={onChange}
      />
    </>
  );
}

/** Shown where a displayed field has no value and no suggestion. The row-level needs badge carries
 * the alarm, so this stays quiet rather than shouting a second time. */
function MissingValue({ children }: { children: string }): ReactElement {
  return <span className="italic text-gray-400 dark:text-gray-500">{children}</span>;
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

  const accept = useCallback(
    () => updateCharge({ chargeId, fields: { userDescription: suggestion! } }),
    [chargeId, suggestion, updateCharge],
  );

  if (trimmed) {
    return <span className="font-medium">{trimmed}</span>;
  }
  if (!suggestion) {
    return <MissingValue>No description</MissingValue>;
  }
  return (
    <SuggestionAffordance
      chargeId={chargeId}
      label={`Accept suggested description "${suggestion}"`}
      onAccept={accept}
      fetching={fetching}
      similar={{ description: suggestion }}
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

  const accept = useCallback(
    () => updateCharge({ chargeId, fields: { tags: suggestedTags.map(tag => ({ id: tag.id })) } }),
    [chargeId, suggestedTags, updateCharge],
  );

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
    return <MissingValue>No tags</MissingValue>;
  }
  return (
    <SuggestionAffordance
      chargeId={chargeId}
      label={`Accept ${suggestedTags.length} suggested tag${suggestedTags.length === 1 ? '' : 's'}`}
      onAccept={accept}
      fetching={fetching}
      similar={{ tagIds: suggestedTags.map(tag => ({ id: tag.id })) }}
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
