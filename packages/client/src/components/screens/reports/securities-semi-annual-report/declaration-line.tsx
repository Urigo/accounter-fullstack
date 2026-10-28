import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../../../lib/utils.js';

/**
 * A Hebrew label over its small English subtitle.
 *
 * The subtitle is laid out left-to-right, so its punctuation stays put, but aligned with the Hebrew
 * above it — with the document's start (right) by default, or its end (left) in a numeric column.
 * The alignment is physical because `start` inside the subtitle would mean its own (left) side.
 */
export function BilingualLabel({
  he,
  en,
  className,
  align = 'start',
}: {
  he: ReactNode;
  en: ReactNode;
  className?: string;
  align?: 'start' | 'end';
}): ReactElement {
  return (
    <div className={cn('min-w-0', align === 'start' ? 'text-right' : 'text-left', className)}>
      <div className="leading-snug">{he}</div>
      <div dir="ltr" lang="en" className="text-xs leading-snug text-gray-500">
        {en}
      </div>
    </div>
  );
}

/** An amount kept left-to-right inside the RTL document, its digits aligned */
export function Amount({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <span dir="ltr" className={cn('whitespace-nowrap tabular-nums', className)}>
      {children}
    </span>
  );
}

/** A numbered line of the letter: number, bilingual label, amount */
export function DeclarationLine({
  number,
  he,
  en,
  amount,
  children,
}: {
  number: number;
  he: ReactNode;
  en: ReactNode;
  amount?: ReactNode;
  children?: ReactNode;
}): ReactElement {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-4 border-b border-gray-200 py-3 break-inside-avoid last:border-b-0">
      <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white [print-color-adjust:exact]">
        {number}
      </span>
      <div className="min-w-0">
        <BilingualLabel he={he} en={en} className="font-medium" />
        {children}
      </div>
      {amount != null && <Amount className="text-base font-semibold">{amount}</Amount>}
    </li>
  );
}

/** A row of a calculation table: label and amount, optionally marked or emphasized */
export function DetailRow({
  marker,
  he,
  en,
  amount,
  emphasis = false,
  muted = false,
}: {
  marker?: string;
  he: ReactNode;
  en: ReactNode;
  amount: ReactNode;
  emphasis?: boolean;
  muted?: boolean;
}): ReactElement {
  return (
    <tr
      className={cn(
        'break-inside-avoid border-b border-gray-100 last:border-b-0',
        emphasis && 'border-t border-gray-300 font-semibold',
        muted && 'text-gray-500',
      )}
    >
      <td className="w-8 py-2 align-top text-xs text-gray-500">{marker && `(${marker})`}</td>
      <td className="py-2">
        <BilingualLabel he={he} en={en} />
      </td>
      <td className="py-2 text-end align-top">
        <Amount>{amount}</Amount>
      </td>
    </tr>
  );
}

/** A section heading of the document, bilingual */
export function SectionHeading({ he, en }: { he: string; en: string }): ReactElement {
  return (
    <h3 className="mb-2 flex items-baseline gap-3 border-b-2 border-gray-900 pb-1">
      <span className="text-base font-bold">{he}</span>
      <span
        dir="ltr"
        lang="en"
        className="text-xs font-medium uppercase tracking-wide text-gray-500"
      >
        {en}
      </span>
    </h3>
  );
}
