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
  ...props
}: React.ComponentProps<typeof TooltipContent> & {
  children: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}): ReactElement {
  if (disabled) {
    return children as ReactElement;
  }
  return (
    <TooltipProvider>
      <TooltipUi>
        <TooltipTrigger>{children}</TooltipTrigger>
        <TooltipContent {...props}>{content}</TooltipContent>
      </TooltipUi>
    </TooltipProvider>
  );
}
