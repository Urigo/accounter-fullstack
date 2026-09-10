import {
  CalendarRange,
  ChevronDown,
  Copy,
  Download,
  Edit2,
  FileText,
  Save,
  Trash2,
} from 'lucide-react';
import { DatePickerInput } from '@/components/common/index.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Switch } from '@/components/ui/switch.js';
import type { TimelessDateString } from '@/helpers/index.js';
import { type Owner, type Template } from './utils/types.js';

interface ToolbarProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  owners: Owner[];
  selectedOwner: string;
  onOwnerChange: (ownerId: string) => void;
  /** True when there is a single owner to pick — the value is shown, not chosen. */
  ownerDisabled?: boolean;
  showZeroed: boolean;
  onShowZeroedChange: (show: boolean) => void;
  editMode: boolean;
  onEditModeChange: (edit: boolean) => void;
  isDirty: boolean;
  currentTemplate: Template | null;
  onSelectTemplate: () => void;
  onSaveAsNew: () => void;
  onResave: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDownloadCSV: () => void;
  isLocked?: boolean;
  /** True while a draft is loaded: the draft owns its period, so the pickers are read-only. */
  datesDisabled?: boolean;
  onChangePeriod: () => void;
  /** Set when the URL overrides the draft's own period, e.g. an annual-audit deep link. */
  periodOverride?: { draftFromDate: string; draftToDate: string } | null;
  onRestoreDraftPeriod: () => void;
  /** Saved baselines, newest first. */
  snapshots: readonly { id: string; createdAt: Date | string; fromDate: string; toDate: string }[];
  activeBaselineId: string | null;
  onBaselineChange: (id: string) => void;
  /** Set when change tracking cannot be shown, explaining why. */
  diffSuspendedReason?: string | null;
}

export function Toolbar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  owners,
  selectedOwner,
  onOwnerChange,
  ownerDisabled = false,
  showZeroed,
  onShowZeroedChange,
  editMode,
  onEditModeChange,
  isDirty,
  currentTemplate,
  onSelectTemplate,
  onSaveAsNew,
  onResave,
  onRename,
  onDuplicate,
  onDelete,
  onDownloadCSV,
  isLocked = false,
  datesDisabled = false,
  onChangePeriod,
  periodOverride = null,
  onRestoreDraftPeriod,
  snapshots,
  activeBaselineId,
  onBaselineChange,
  diffSuspendedReason = null,
}: ToolbarProps) {
  const hasTemplate = currentTemplate !== null;

  const baselineLabel = (snapshot: { createdAt: Date | string }, index: number): string => {
    const when = new Date(snapshot.createdAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return index === 0 ? `Last save · ${when}` : when;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-muted/30">
      {/* Left side: Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="from-date" className="text-sm text-muted-foreground">
            From
          </Label>
          <DatePickerInput
            id="from-date"
            value={fromDate as TimelessDateString}
            onChange={e => onFromDateChange(e ?? '')}
            className="w-36"
            disabled={datesDisabled}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="to-date" className="text-sm text-muted-foreground">
            To
          </Label>
          <DatePickerInput
            id="to-date"
            value={toDate as TimelessDateString}
            onChange={e => onToDateChange(e ?? '')}
            className="w-36"
            disabled={datesDisabled}
          />
        </div>

        <Select value={selectedOwner} onValueChange={onOwnerChange} disabled={ownerDisabled}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select owner" />
          </SelectTrigger>
          <SelectContent>
            {owners.map(owner => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="show-zeroed" checked={showZeroed} onCheckedChange={onShowZeroedChange} />
          <Label htmlFor="show-zeroed" className="text-sm cursor-pointer">
            Show zeroed accounts
          </Label>
        </div>

        {periodOverride && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-300">
              Draft period is {periodOverride.draftFromDate} to {periodOverride.draftToDate}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onRestoreDraftPeriod}>
              Back to draft period
            </Button>
          </div>
        )}
      </div>

      {/* Right side: Template controls */}
      <div className="flex items-center gap-3">
        {!isLocked && (
          <div className="flex items-center gap-2">
            <Switch id="edit-mode" checked={editMode} onCheckedChange={onEditModeChange} />
            <Label htmlFor="edit-mode" className="text-sm cursor-pointer font-medium">
              Edit Mode
            </Label>
          </div>
        )}

        {isDirty && (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            Unsaved changes
          </Badge>
        )}

        {hasTemplate && diffSuspendedReason && (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
            {diffSuspendedReason}
          </Badge>
        )}

        {hasTemplate && snapshots.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="baseline" className="text-sm text-muted-foreground">
              Compare to
            </Label>
            <Select
              value={activeBaselineId ?? undefined}
              onValueChange={value => onBaselineChange(value)}
            >
              <SelectTrigger id="baseline" className="w-52">
                <SelectValue placeholder="Last save" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot, index) => (
                  <SelectItem key={snapshot.id} value={snapshot.id}>
                    {baselineLabel(snapshot, index)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FileText className="size-4" />
              {currentTemplate?.name || 'No template'}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onSelectTemplate}>
              <FileText className="size-4 mr-2" />
              Select template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSaveAsNew}>
              <Save className="size-4 mr-2" />
              Save as new
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onResave} disabled={!hasTemplate || isLocked}>
              <Save className="size-4 mr-2" />
              Resave
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onChangePeriod} disabled={!hasTemplate || isLocked}>
              <CalendarRange className="size-4 mr-2" />
              Change period
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename} disabled={!hasTemplate || isLocked}>
              <Edit2 className="size-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate} disabled={!hasTemplate}>
              <Copy className="size-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={!hasTemplate || isLocked}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" onClick={onDownloadCSV}>
          <Download className="size-4 mr-2" />
          Download CSV
        </Button>
      </div>
    </div>
  );
}
