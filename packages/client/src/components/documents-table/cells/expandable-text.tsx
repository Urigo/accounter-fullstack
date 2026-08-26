import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/utils.js';
import { Button } from '../../ui/button.js';

/** Longer values collapse behind a "Show more" toggle. */
export const EXPANDABLE_TEXT_MAX_LENGTH = 80;

type Props = {
  text?: string | null;
  /** Collapse text longer than this many characters. */
  maxLength?: number;
  className?: string;
};

/**
 * Free-text table cell content. Document descriptions and remarks can be long, and some carry
 * unbroken tokens (a forwarded mail's Message-ID, for instance) that would otherwise stretch the
 * column across the table — hence the width cap and `wrap-anywhere`, which breaks mid-word only
 * when a word cannot fit on its own line.
 */
export const ExpandableText = ({
  text,
  maxLength = EXPANDABLE_TEXT_MAX_LENGTH,
  className,
}: Props): ReactElement | null => {
  const [expanded, setExpanded] = useState(false);

  if (!text) {
    return null;
  }

  const isCollapsible = text.length > maxLength;
  const visibleText = isCollapsible && !expanded ? `${text.slice(0, maxLength).trimEnd()}…` : text;

  return (
    <div className={cn('flex max-w-xs flex-col justify-center wrap-anywhere', className)}>
      <p className="whitespace-pre-wrap">{visibleText}</p>
      {isCollapsible && (
        <Button
          variant="link"
          size="sm"
          className="h-auto self-start p-0 text-xs"
          aria-expanded={expanded}
          onClick={event => {
            // Hosts render this inside clickable/expandable rows.
            event.stopPropagation();
            setExpanded(current => !current);
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
};
