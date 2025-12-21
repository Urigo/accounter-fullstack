import type { CSSProperties, ReactElement } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Drawer, DrawerContent, DrawerHeader } from '@/components/ui/drawer.js';

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
  return (
    <Drawer direction={position} open={opened} onClose={onClose} modal={false}>
      <DrawerContent asChild withOverlay={withOverlay}>
        <div>
          <DrawerHeader className="flex flex-row justify-between">
            {title}
            {withCloseButton && (
              <Button size="icon" className="size-6" variant="ghost" onClick={onClose}>
                <X className="size-4 text-gray-500" />
              </Button>
            )}
          </DrawerHeader>
          <div className="mx-auto w-full px-4 pb-4">{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
