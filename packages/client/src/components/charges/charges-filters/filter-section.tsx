import type { ReactElement, ReactNode } from 'react';
import { useWatch } from 'react-hook-form';
import { AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion.js';
import { Badge } from '../../ui/badge.js';
import type { CountableFilter } from './counts.js';
import type { ChargeFilterFormValues } from './schema.js';

type CountSelector = (filter: CountableFilter) => number;

/**
 * Reads the whole form off the FormProvider context. Kept as its own leaf so a
 * keystroke in the free-text box re-renders the badge alone, not the modal body.
 */
export function FilterCount({ selector }: { selector: CountSelector }): ReactElement | null {
  const values = useWatch<ChargeFilterFormValues>();
  const count = selector(values as CountableFilter);
  if (!count) return null;
  return (
    <Badge className="size-5 shrink-0 justify-center rounded-full p-0 text-xs tabular-nums">
      {count}
    </Badge>
  );
}

export function FilterSection({
  value,
  label,
  selector,
  children,
}: {
  value: string;
  label: string;
  selector?: CountSelector;
  children: ReactNode;
}): ReactElement {
  return (
    <AccordionItem value={value} className="border-b last:border-b-0">
      <AccordionTrigger className="mx-0 my-0 px-4 py-3 hover:no-underline">
        <span className="flex items-center gap-2 text-sm font-medium">
          {label}
          {selector && <FilterCount selector={selector} />}
        </span>
      </AccordionTrigger>
      <AccordionContent className="mx-0 space-y-4 px-4 pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}
