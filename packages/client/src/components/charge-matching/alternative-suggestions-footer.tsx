import { type ReactElement } from 'react';
import { Button } from '../ui/button.js';

export type FooterSuggestion = {
  chargeId: string;
  confidenceScore: number;
  label: string;
};

type Props = {
  suggestions: FooterSuggestion[];
  /** Index of the suggestion currently shown in the comparison view (0 = top match) */
  selectedIndex: number;
  onSelect: (index: number) => void;
};

/**
 * Horizontal list of the alternative match suggestions (rank 1, 2, 3, ...).
 * Clicking one swaps it into the "Suggested Match" comparison view.
 */
export const AlternativeSuggestionsFooter = ({
  suggestions,
  selectedIndex,
  onSelect,
}: Props): ReactElement | null => {
  if (suggestions.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-500">Alternative Suggestions</h3>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <Button
            key={suggestion.chargeId}
            variant={index === selectedIndex ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelect(index)}
            aria-pressed={index === selectedIndex}
          >
            <span className="font-semibold">#{index + 1}</span>
            <span className="max-w-40 truncate">{suggestion.label}</span>
            <span className="text-xs opacity-70">
              {Math.round(suggestion.confidenceScore * 100)}%
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};
