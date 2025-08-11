import { useMemo, type FC, type ReactElement, type ReactNode } from 'react';
import { calcPatch } from 'fast-myers-diff';
import { Check } from 'lucide-react';
import type { TimelessDateString } from '../../../../helpers/index.js';

type PropsWithChildren<P = unknown> = P & {
  children: ReactNode;
};

const Insertion: FC<PropsWithChildren> = ({ children }) => (
  <span className="bg-green-100">{children}</span>
);

const Deletion: FC<PropsWithChildren> = ({ children }) => (
  <span className="bg-red-100 line-through">{children}</span>
);

const Unchanged: FC<PropsWithChildren> = ({ children }) => <span>{children}</span>;

type Props = {
  content: string;
  contentOrigin?: string | null;
  monthDate: TimelessDateString;
};

export const Pcn874ReportPatch = ({ content, contentOrigin, monthDate }: Props): ReactElement => {
  const children = useMemo(() => {
    const children: ReactNode[] = [];

    if (!contentOrigin) {
      return children;
    }

    const contentChars = content.split('');
    const contentOriginChars = contentOrigin.split('');

    const linesPatch = Array.from(calcPatch(contentOriginChars, contentChars));

    const parts = [] as [content: string, wrapper: FC<PropsWithChildren>][];
    let i = 0; // Taking subarrays is cheaper than slicing for TypedArrays.
    for (const [deletionStart, deletionEnd, insertion] of linesPatch) {
      if (
        parts.length === 0 &&
        deletionStart >= 17 &&
        deletionEnd <= 25 &&
        insertion.length === deletionEnd - deletionStart
      ) {
        // ignore report issue date change
        if (linesPatch.length === 1) {
          return children;
        }
        continue;
      } else {
        // add unchanged part
        if (i < deletionStart)
          parts.push([contentOriginChars.slice(i, deletionStart).join(''), Unchanged]);
        // add deletion part
        if (deletionEnd > deletionStart) {
          parts.push([contentOriginChars.slice(deletionStart, deletionEnd).join(''), Deletion]);
        }
        // add insertion part
        if (insertion.length > 0) parts.push([insertion.join(''), Insertion]);
        // update index
        i = deletionEnd;
      }
    }
    if (i < contentOriginChars.length)
      parts.push([contentOriginChars.slice(i).join(''), Unchanged]);

    let subChildren: ReactNode[] = [];
    for (const [content, Wrapper] of parts) {
      const subParts = content.split('\n');
      if (subParts.length === 1) {
        subChildren.push(<Wrapper key={`unchanged-${subChildren.length}`}>{content}</Wrapper>);
      } else {
        subParts.map((content, i) => {
          subChildren.push(<Wrapper key={i}>{content}</Wrapper>);
          children.push(<div key={children.length - 1}>{subChildren}</div>);
          subChildren = [];
        });
      }
    }
    if (subChildren.length > 0) {
      children.push(<div key={children.length - 1}>{subChildren}</div>);
    }
    return children;
  }, [content, contentOrigin]);

  return (
    <div className="flex flex-col">
      <div className="text-sm text-gray-500 flex flex-row gap-2">
        <span className="font-bold">Month:</span>
        <span>{monthDate.slice(0, 7)}</span>
        {!children.length && <Check className="text-green-500" />}
      </div>
      {!!children.length && children}
    </div>
  );
};
