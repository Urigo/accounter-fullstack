import { useState, type CSSProperties, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { PortalContainerContext } from '../../../providers/portal-container.js';
import { Button } from '../../ui/button.js';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../../ui/drawer.js';

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
  children?: ReactElement | ReactElement[];
}

export const PopUpDrawer = ({
  children,
  position,
  title,
  withOverlay = false,
  withCloseButton = true,
  opened = false,
  onClose = (): void => {
    return;
  },
}: PopUpDrawerProps): ReactElement => {
  // Expose the drawer's content element so overlays (popovers, dropdowns) rendered inside can portal
  // into it instead of `document.body`. The drawer's Radix Dialog is always modal and traps focus,
  // so body-portaled overlays would otherwise be unusable inside the drawer.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <Drawer direction={position} open={opened} onClose={onClose} modal={false}>
      <DrawerContent asChild withOverlay={withOverlay}>
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
          <div className="mx-auto w-full px-4 pb-4" ref={setContainer}>
            <PortalContainerContext.Provider value={container}>
              {children}
            </PortalContainerContext.Provider>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
