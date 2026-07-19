import { type ReactElement } from 'react';
import { CheckCircle2, Circle, CircleSlash, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ChargeMatchItemStatus } from '../../hooks/use-charge-match-queue.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.js';
import { ScrollArea } from '../ui/scroll-area.js';

export type ChargeMatchingSidebarItem = {
  id: string;
  title: string;
  subtitle?: string;
  amount?: string;
};

type Props = {
  items: ChargeMatchingSidebarItem[];
  statusById: Record<string, ChargeMatchItemStatus>;
  activeId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Pin a base charge as the active item under review */
  onSelectItem: (id: string) => void;
};

function StatusIcon({ status }: { status: ChargeMatchItemStatus }): ReactElement {
  switch (status) {
    case 'matched':
      return <CheckCircle2 className="size-4 shrink-0 text-green-600" aria-label="Matched" />;
    case 'skipped':
      return <CircleSlash className="size-4 shrink-0 text-gray-400" aria-label="Skipped" />;
    default:
      return <Circle className="size-4 shrink-0 text-gray-300" aria-label="Pending" />;
  }
}

export const ChargeMatchingSidebar = ({
  items,
  statusById,
  activeId,
  collapsed,
  onToggleCollapsed,
  onSelectItem,
}: Props): ReactElement => {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-r pr-3 transition-all',
        collapsed ? 'w-10' : 'w-72 shrink-0',
      )}
    >
      <div className="flex items-center justify-between">
        {!collapsed && <h3 className="text-sm font-semibold">Awaiting Matches</h3>}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
      {!collapsed && (
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <ul className="flex flex-col gap-1">
            {items.map(item => {
              const status = statusById[item.id] ?? 'pending';
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    aria-current={item.id === activeId ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60',
                      item.id === activeId && 'bg-accent',
                      status === 'skipped' && 'opacity-50',
                    )}
                  >
                    <StatusIcon status={status} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="truncate text-xs text-gray-500">
                        {[item.subtitle, item.amount].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-gray-500">No charges awaiting match</li>
            )}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
};
