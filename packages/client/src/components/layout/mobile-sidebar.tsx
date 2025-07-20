import { useState, type JSX } from 'react';
import { MenuIcon } from 'lucide-react';
import { UniformFormatFilesDownloadModal } from '../common/modals/uniform-format-files-modal.js';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet.js';
import { Nav } from './nav.js';
import { sidelinks, type SideLink } from './sidelinks.js';

export function MobileSidebar(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [uniformFormatModalOpen, setUniformFormatModalOpen] = useState(false);

  // Create enhanced sidelinks with modal actions
  const enhancedSidelinks: SideLink[] = sidelinks.map(link => {
    if (link.sub) {
      return {
        ...link,
        sub: link.sub.map(sublink => {
          // Handle the Generate Uniform Files action
          if (sublink.title === 'Generate Uniform Files') {
            return {
              ...sublink,
              action: () => {
                setOpen(false); // Close mobile sidebar first
                setUniformFormatModalOpen(true);
              },
            };
          }
          return sublink;
        }),
      };
    }
    return link;
  });

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <MenuIcon />
        </SheetTrigger>
        <SheetContent side="left" className="px-0!">
          <div className="space-y-4 py-4">
            <div className="px-3 py-2">
              <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Overview</h2>
              <div className="space-y-1">
                <Nav
                  isCollapsed={false}
                  links={enhancedSidelinks}
                  closeNav={() => setOpen(false)}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Controlled modal */}
      <UniformFormatFilesDownloadModal
        open={uniformFormatModalOpen}
        onOpenChange={setUniformFormatModalOpen}
      />
    </>
  );
}
