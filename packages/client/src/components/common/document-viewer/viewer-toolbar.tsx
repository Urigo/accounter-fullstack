import { useState, type ReactElement } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { Button } from '../../ui/button.js';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group.js';
import { Toggle } from '../../ui/toggle.js';
import { Tooltip } from '../tooltip.js';
import type { FitMode, LoupeSize, ZoomMode } from './types.js';

const FIT_MODES: { value: FitMode; label: string; tooltip: string }[] = [
  { value: 'page', label: 'Fit page', tooltip: 'Show the whole page' },
  { value: 'width', label: 'Fit width', tooltip: 'Fit the page to the pane width' },
  { value: 'actual', label: '100%', tooltip: 'Natural size' },
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
        onBlur={() => setDraft(null)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const value = Number.parseFloat(draft);
            if (Number.isFinite(value) && value > 0) {
              onZoomChange(value / 100);
            }
            setDraft(null);
          } else if (e.key === 'Escape') {
            setDraft(null);
          }
        }}
      />
    );
  }

  return (
    <Tooltip content="Type a zoom level" asChild>
      <Button
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
    <div
      role="toolbar"
      aria-label="Document viewer controls"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-white px-3 py-1.5 dark:bg-gray-950"
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
            title={fit.tooltip}
            className="px-2 text-xs"
          >
            {fit.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {showMagnifier && (
        <div className="flex items-center gap-1">
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
