import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Ellipsis, Minus, Plus, Search } from 'lucide-react';
import { Button } from '../../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu.js';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group.js';
import { Toggle } from '../../ui/toggle.js';
import { Tooltip } from '../tooltip.js';
import type { FitMode, LoupeSize, ZoomMode } from './types.js';

/** `short` is shown in a narrow viewer (under the `@md` container width). */
const FIT_MODES: { value: FitMode; label: string; short: string; tooltip: string }[] = [
  { value: 'page', label: 'Fit page', short: 'Page', tooltip: 'Show the whole page' },
  { value: 'width', label: 'Fit width', short: 'Width', tooltip: 'Fit the page to the pane width' },
  { value: 'actual', label: '100%', short: '100%', tooltip: 'Natural size' },
];

const LOUPE_SIZES: { value: LoupeSize; label: string; name: string }[] = [
  { value: 'sm', label: 'S', name: 'Small' },
  { value: 'md', label: 'M', name: 'Medium' },
  { value: 'lg', label: 'L', name: 'Large' },
];

function isFitMode(value: string): value is FitMode {
  return value === 'page' || value === 'width' || value === 'actual';
}

function isLoupeSize(value: string): value is LoupeSize {
  return value === 'sm' || value === 'md' || value === 'lg';
}

export interface ViewerToolbarProps {
  /** The toolbar stays disabled until the image size is known. */
  disabled: boolean;
  zoom: number;
  mode: ZoomMode;
  onZoomIn(): void;
  onZoomOut(): void;
  /** An explicit zoom, where 1 is 100%. */
  onZoomChange(zoom: number): void;
  onFitModeChange(mode: FitMode): void;
  /** Hidden on touch-only devices, where there is no hover to drive it. */
  showMagnifier: boolean;
  magnifierOn: boolean;
  onMagnifierChange(on: boolean): void;
  loupeSize: LoupeSize;
  onLoupeSizeChange(size: LoupeSize): void;
}

function ZoomReadout({
  zoom,
  disabled,
  onZoomChange,
}: {
  zoom: number;
  disabled: boolean;
  onZoomChange(zoom: number): void;
}): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const percent = Math.round(zoom * 100);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // Closing the editor with Enter or Esc unmounts the focused input, so focus goes back to the
  // readout button. A blur means focus already moved somewhere else, and stays there.
  const restoreFocus = useRef(false);

  const closeEditor = (refocus: boolean): void => {
    restoreFocus.current = refocus;
    setDraft(null);
  };

  useEffect(() => {
    if (draft == null && restoreFocus.current) {
      restoreFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [draft]);

  if (draft != null && !disabled) {
    return (
      <input
        // A fresh input is mounted on purpose: the user just asked to type a zoom.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        type="number"
        inputMode="numeric"
        aria-label="Zoom percentage"
        // Esc cancels the edit; the drawer around the viewer must not close on it too.
        data-local-escape
        className="h-8 w-16 rounded-md border border-gray-300 px-1 text-center text-sm tabular-nums"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={() => closeEditor(false)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const value = Number.parseFloat(draft);
            if (Number.isFinite(value) && value > 0) {
              onZoomChange(value / 100);
            }
            closeEditor(true);
          } else if (e.key === 'Escape') {
            closeEditor(true);
          }
        }}
      />
    );
  }

  return (
    <Tooltip content="Type a zoom level" asChild>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="w-16 tabular-nums"
        disabled={disabled}
        aria-label={`Zoom ${percent}%, click to type a value`}
        onClick={() => setDraft(String(percent))}
      >
        {percent}%
      </Button>
    </Tooltip>
  );
}

/**
 * The `⋯` menu of a narrow viewer (under the `@lg` container width), holding the controls the
 * toolbar has no room for: the magnifier and its loupe size. Rotate joins it in PR 5.
 */
function MoreMenu({
  disabled,
  magnifierOn,
  onMagnifierChange,
  loupeSize,
  onLoupeSizeChange,
}: Pick<
  ViewerToolbarProps,
  'disabled' | 'magnifierOn' | 'onMagnifierChange' | 'loupeSize' | 'onLoupeSizeChange'
>): ReactElement {
  return (
    <DropdownMenu>
      <Tooltip content="More view options" asChild>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 @lg:hidden"
            aria-label="More view options"
            disabled={disabled}
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuCheckboxItem
          checked={magnifierOn}
          onCheckedChange={checked => onMagnifierChange(checked === true)}
          // Keep the menu open, so the loupe size can be picked right after.
          onSelect={event => event.preventDefault()}
        >
          <Search className="size-4" />
          Magnifier
        </DropdownMenuCheckboxItem>
        {magnifierOn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-gray-500">
              Loupe size
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={loupeSize}
              onValueChange={value => {
                if (isLoupeSize(value)) {
                  onLoupeSizeChange(value);
                }
              }}
            >
              {LOUPE_SIZES.map(option => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ViewerToolbar({
  disabled,
  zoom,
  mode,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  onFitModeChange,
  showMagnifier,
  magnifierOn,
  onMagnifierChange,
  loupeSize,
  onLoupeSizeChange,
}: ViewerToolbarProps): ReactElement {
  return (
    // Condenses through container queries on the viewer root (`@container`), so a narrow docked
    // column or edit pane condenses as a phone does.
    <div
      role="toolbar"
      aria-label="Document viewer controls"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-white px-2 py-1.5 @md:gap-x-3 @md:px-3 dark:bg-gray-950"
    >
      <div className="flex items-center">
        <Tooltip content="Zoom out" asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Zoom out"
            disabled={disabled}
            onClick={onZoomOut}
          >
            <Minus className="size-4" />
          </Button>
        </Tooltip>
        <ZoomReadout zoom={zoom} disabled={disabled} onZoomChange={onZoomChange} />
        <Tooltip content="Zoom in" asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Zoom in"
            disabled={disabled}
            onClick={onZoomIn}
          >
            <Plus className="size-4" />
          </Button>
        </Tooltip>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Fit mode"
        disabled={disabled}
        value={mode === 'custom' ? '' : mode}
        onValueChange={value => {
          if (isFitMode(value)) {
            onFitModeChange(value);
          }
        }}
      >
        {FIT_MODES.map(fit => (
          <ToggleGroupItem
            key={fit.value}
            value={fit.value}
            // One accessible name whichever label is showing.
            aria-label={fit.label}
            title={fit.tooltip}
            className="px-2 text-xs"
          >
            <span className="@md:hidden">{fit.short}</span>
            <span className="hidden @md:inline">{fit.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {showMagnifier && (
        <MoreMenu
          disabled={disabled}
          magnifierOn={magnifierOn}
          onMagnifierChange={onMagnifierChange}
          loupeSize={loupeSize}
          onLoupeSizeChange={onLoupeSizeChange}
        />
      )}

      {showMagnifier && (
        // Inline from the `@lg` container width; below it, the `⋯` menu holds these.
        <div className="hidden items-center gap-1 @lg:flex">
          {/* The span takes the tooltip trigger's `data-state`, which would otherwise overwrite
              the toggle's own `data-state="on"`. */}
          <Tooltip
            content={magnifierOn ? 'Turn the magnifier off' : 'Magnify under the cursor'}
            asChild
          >
            <span className="inline-flex">
              <Toggle
                size="sm"
                variant="outline"
                aria-label="Magnifier"
                disabled={disabled}
                pressed={magnifierOn}
                onPressedChange={onMagnifierChange}
                className="text-xs"
              >
                <Search className="size-4" />
                Magnifier
              </Toggle>
            </span>
          </Tooltip>
          {magnifierOn && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-label="Loupe size"
              disabled={disabled}
              value={loupeSize}
              onValueChange={value => {
                if (isLoupeSize(value)) {
                  onLoupeSizeChange(value);
                }
              }}
            >
              {LOUPE_SIZES.map(option => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={`${option.name} loupe`}
                  title={`${option.name} loupe`}
                  className="px-2 text-xs"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      )}
    </div>
  );
}
