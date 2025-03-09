import { ReactElement, ReactNode } from 'react';
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip as TooltipUi,
} from '../ui/tooltip.js';

export function Tooltip({
  children,
  content,
  ...props
}: React.ComponentProps<typeof TooltipContent> & {
  children: ReactNode;
  content: ReactNode;
}): ReactElement {
  return (
    <TooltipProvider>
      <TooltipUi>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent {...props}>{content}</TooltipContent>
      </TooltipUi>
    </TooltipProvider>
  );
}
