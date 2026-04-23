import { ChevronDown, Copy, Download, Edit2, FileText, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Switch } from '@/components/ui/switch.js';
import { type Owner, type Template } from './types.js';

interface ToolbarProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  owners: Owner[];
  selectedOwner: string;
  onOwnerChange: (ownerId: string) => void;
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
}

export function Toolbar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  owners,
  selectedOwner,
  onOwnerChange,
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
}: ToolbarProps) {
  const hasTemplate = currentTemplate !== null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-muted/30">
      {/* Left side: Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="from-date" className="text-sm text-muted-foreground">
            From
          </Label>
          <Input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={e => onFromDateChange(e.target.value)}
            className="w-36"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="to-date" className="text-sm text-muted-foreground">
            To
          </Label>
          <Input
            id="to-date"
            type="date"
            value={toDate}
            onChange={e => onToDateChange(e.target.value)}
            className="w-36"
          />
        </div>

        <Select value={selectedOwner} onValueChange={onOwnerChange}>
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
      </div>

      {/* Right side: Template controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch id="edit-mode" checked={editMode} onCheckedChange={onEditModeChange} />
          <Label htmlFor="edit-mode" className="text-sm cursor-pointer font-medium">
            Edit Mode
          </Label>
        </div>

        {isDirty && (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            Unsaved changes
          </Badge>
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
            <DropdownMenuItem onClick={onResave} disabled={!hasTemplate}>
              <Save className="size-4 mr-2" />
              Resave
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename} disabled={!hasTemplate}>
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
              disabled={!hasTemplate}
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
