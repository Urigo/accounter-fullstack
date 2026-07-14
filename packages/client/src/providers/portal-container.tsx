import { createContext, useContext } from 'react';

/**
 * Holds a DOM element that overlays (popovers, dropdowns) should portal into instead of the default
 * `document.body`.
 *
 * This exists to work around focus-trapping modal layers. `PopUpDrawer` renders a vaul `Drawer`
 * whose underlying Radix `Dialog` is always modal (vaul 1.1.2 does not forward `modal={false}` to
 * it), so it traps focus and blocks interaction with anything portaled outside the dialog. Overlays
 * that portal to `document.body` therefore become unusable inside such a drawer. Providing the
 * drawer's own content element here lets those overlays render inside the dialog's focus scope.
 *
 * When no provider is present the value is `null`, and consumers should fall back to the default
 * (`document.body`) portaling behavior.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
