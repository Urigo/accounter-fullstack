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
}: React.ComponentProps<typeof TooltipContent> & {
  children: ReactNode;
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
