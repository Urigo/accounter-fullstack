import { useState } from 'react';
import { MenuIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet.js';
import { Nav } from './nav.js';
import { sidelinks } from './sidelinks.js';

export function MobileSidebar(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="!px-0">
        <div className="space-y-4 py-4">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Overview</h2>
            <div className="space-y-1">
              <Nav isCollapsed={false} links={sidelinks} closeNav={() => setOpen(false)} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
