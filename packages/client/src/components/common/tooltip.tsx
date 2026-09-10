import type { ReactElement, ReactNode } from 'react';
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip as TooltipUi,
} from '../ui/tooltip.js';

export function Tooltip({
  children,
  content,
  disabled,
  asChild = false,
  ...props
}: Omit<React.ComponentProps<typeof TooltipContent>, 'content'> & {
  children: ReactNode;
  /**
   * `content` is omitted from the base props before being redeclared: React's
   * `HTMLAttributes` carries an RDFa `content?: string`, so intersecting the two narrowed
   * this to `string & ReactNode` and rejected any JSX tooltip body.
   */
  content: ReactNode;
  disabled?: boolean;
  asChild?: boolean;
}): ReactElement {
  if (disabled) {
    return children as ReactElement;
  }
  return (
    <TooltipProvider>
      <TooltipUi>
        <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
        <TooltipContent {...props}>{content}</TooltipContent>
      </TooltipUi>
    </TooltipProvider>
  );
}
