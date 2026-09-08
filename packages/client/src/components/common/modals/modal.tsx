import type { MouseEventHandler, ReactElement, ReactNode } from 'react';
import { cn } from '../../../lib/utils.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog.js';

/**
 * Mantine's `size` vocabulary, translated to the dialog's max width. `xl` is the only named
 * size any call site uses; `fit-content` and `auto` came from the drawer's copy of this prop.
 */
const modalSizeClasses: Record<string, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
  auto: 'sm:max-w-fit',
  'fit-content': 'sm:max-w-fit',
};

export interface ModalProps {
  content?: ReactNode;
  /** Heading for the dialog. When omitted, an accessible name is still provided. */
  title?: ReactNode;
  description?: ReactNode;
  opened?: boolean;
  onClose?: () => void;
  /** Mirrors the old Mantine prop; maps onto `DialogContent`'s `showCloseButton`. */
  withCloseButton?: boolean;
  /** Mantine size name, translated to a max-width class. */
  modalSize?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}

/**
 * The filter dialog used across the reports and charts screens. Replaces Mantine's `Modal`.
 *
 * Radix requires every dialog to have a title for assistive tech, and none of the call sites
 * pass one, so an `sr-only` fallback is rendered instead of leaving the dialog unnamed (which
 * Radix warns about at runtime).
 */
export const PopUpModal = ({
  content,
  title,
  description,
  opened = false,
  onClose = (): void => {
    return;
  },
  withCloseButton = false,
  modalSize,
  children,
  onClick,
  className,
}: ModalProps): ReactElement => {
  return (
    <Dialog open={opened} onOpenChange={next => !next && onClose()}>
      <DialogContent
        showCloseButton={withCloseButton}
        onClick={onClick}
        className={cn(
          // Several filter forms are taller than the viewport; 17 other DialogContent sites
          // use this same pairing.
          'max-h-[90vh] overflow-y-auto',
          modalSize && modalSizeClasses[modalSize],
          className,
        )}
      >
        <DialogHeader className={title || description ? undefined : 'sr-only'}>
          <DialogTitle>{title ?? 'Filters'}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {content}
        {children}
      </DialogContent>
    </Dialog>
  );
};
