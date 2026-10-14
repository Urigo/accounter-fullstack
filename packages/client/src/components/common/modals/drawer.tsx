import { useState, type CSSProperties, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { PortalContainerContext } from '../../../providers/portal-container.js';
import { Button } from '../../ui/button.js';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../../ui/drawer.js';

/**
 * - `default`: the house drawer width (`w-3/4 sm:max-w-sm`) and a padded body.
 * - `document`: for the document viewer. Full width on phones and half the viewport (at least
 *   420px) from `sm` up, with a flex body that gives its content a definite height to scroll in.
 */
export type PopUpDrawerSize = 'default' | 'document';

// Overrides must reuse the exact `data-[vaul-drawer-direction=…]:` prefixes from `ui/drawer.tsx`:
// tailwind-merge only dedupes identical variant prefixes, and the attribute variants are more
// specific than a plain `w-full`.
const SIZE_CLASSES: Record<PopUpDrawerSize, string | undefined> = {
  default: undefined,
  document:
    'data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:w-1/2 data-[vaul-drawer-direction=right]:sm:min-w-105 data-[vaul-drawer-direction=right]:sm:max-w-none',
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
  /**
   * Render the header row. With `false`, the content brings its own header and only a visually
   * hidden title (Radix requires one) is rendered, from `accessibleTitle`.
   */
  withHeader?: boolean;
  accessibleTitle?: string;
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
  withHeader = true,
  accessibleTitle,
  onClose = (): void => {
    return;
  },
}: PopUpDrawerProps): ReactElement => {
  // Expose the drawer's content element so overlays (popovers, dropdowns) rendered inside can portal
  // into it instead of `document.body`. The drawer's Radix Dialog is always modal and traps focus,
  // so body-portaled overlays would otherwise be unusable inside the drawer.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const isDocument = size === 'document';
  return (
    <Drawer
      direction={position}
      open={opened}
      onClose={onClose}
      modal={false}
      // The document viewer pans on drag; only a dedicated handle (there is none) may drag it.
      handleOnly={isDocument}
    >
      <DrawerContent
        asChild
        withOverlay={withOverlay}
        className={SIZE_CLASSES[size]}
        onEscapeKeyDown={event => {
          // An input that handles Esc itself (cancelling an edit) keeps the drawer open.
          if (event.target instanceof Element && event.target.closest('[data-local-escape]')) {
            event.preventDefault();
          }
        }}
      >
        <div>
          {withHeader ? (
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
          ) : (
            <DrawerTitle className="sr-only">{accessibleTitle}</DrawerTitle>
          )}
          <div
            className={cn(isDocument ? 'flex min-h-0 flex-1 flex-col' : 'mx-auto w-full px-4 pb-4')}
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
