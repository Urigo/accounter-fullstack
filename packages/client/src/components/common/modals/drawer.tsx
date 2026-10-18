import { useState, type CSSProperties, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { PortalContainerContext } from '../../../providers/portal-container.js';
import { Button } from '../../ui/button.js';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../../ui/drawer.js';

/**
 * - `default`: the house drawer width (`w-3/4 sm:max-w-sm`) and a padded body.
 * - `tall`: a bottom sheet of 90% of the viewport (the house sheet stops at 80%), with a flex body
 *   that gives its content a definite height to scroll in. The height is definite, not just a
 *   maximum, so a short form can't collapse a pane beside it. For the edit-document split.
 */
export type PopUpDrawerSize = 'default' | 'tall';

// Overrides must reuse the exact `data-[vaul-drawer-direction=…]:` prefixes from `ui/drawer.tsx`:
// tailwind-merge only dedupes identical variant prefixes, and the attribute variants are more
// specific than a plain `w-full`.
const SIZE_CLASSES: Record<PopUpDrawerSize, string | undefined> = {
  default: undefined,
  // No core 90vh utility; this mirrors the house `max-h-[80vh]`.
  tall: 'data-[vaul-drawer-direction=bottom]:h-[90vh] data-[vaul-drawer-direction=bottom]:max-h-[90vh]',
};

export interface PopUpDrawerProps {
  ButtonDisplay?: ReactElement;
  style?: CSSProperties;
  title?: ReactElement;
  modalSize?: string;
  opened?: boolean;
  padding?: number;
  onClose?: () => void;
  position?: 'left' | 'right' | 'top' | 'bottom';
  withOverlay?: boolean;
  withCloseButton?: boolean;
  lockScroll?: boolean;
  size?: PopUpDrawerSize;
  children?: ReactElement | ReactElement[];
}

export const PopUpDrawer = ({
  children,
  position,
  title,
  withOverlay = false,
  withCloseButton = true,
  opened = false,
  size = 'default',
  onClose = (): void => {
    return;
  },
}: PopUpDrawerProps): ReactElement => {
  // Expose the drawer's content element so overlays (popovers, dropdowns) rendered inside can portal
  // into it instead of `document.body`. The drawer's Radix Dialog is always modal and traps focus,
  // so body-portaled overlays would otherwise be unusable inside the drawer.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const hasFlexBody = size !== 'default';
  return (
    <Drawer direction={position} open={opened} onClose={onClose} modal={false}>
      <DrawerContent
        asChild
        withOverlay={withOverlay}
        className={SIZE_CLASSES[size]}
        onEscapeKeyDown={event => {
          // An Esc something inside already handled (the edit split collapsing its expanded
          // viewer) keeps the drawer open, and so does an input that handles Esc itself
          // (cancelling an edit). Radix only dismisses when the event isn't default-prevented.
          if (
            event.defaultPrevented ||
            (event.target instanceof Element && event.target.closest('[data-local-escape]'))
          ) {
            event.preventDefault();
          }
        }}
      >
        <div>
          <DrawerHeader className="flex flex-row justify-start">
            <DrawerTitle />
            <div className="flex flex-row justify-between w-full">
              {title}
              {withCloseButton && (
                <Button size="icon" className="size-6" variant="ghost" onClick={onClose}>
                  <X className="size-4 text-gray-500" />
                </Button>
              )}
            </div>
          </DrawerHeader>
          <div
            className={cn(
              hasFlexBody ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full px-4 pb-4',
            )}
            ref={setContainer}
          >
            <PortalContainerContext.Provider value={container}>
              {children}
            </PortalContainerContext.Provider>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
