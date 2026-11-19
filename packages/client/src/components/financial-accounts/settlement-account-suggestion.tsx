import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button.js';

export interface SettlementAccountSuggestionValue {
  id: string;
  name: string;
  number: string;
  /** The card's linked debits that come from this bank account */
  linksCount: number;
}

interface Props {
  suggestion: SettlementAccountSuggestionValue;
  onUse: (bankAccountId: string) => void;
}

/** The bank account a card's linked debits mostly come from, offered as its settlement account */
export function SettlementAccountSuggestion({ suggestion, onUse }: Props): ReactElement {
  const label =
    suggestion.name === suggestion.number
      ? suggestion.number
      : `${suggestion.name} (${suggestion.number})`;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm">
      <span className="text-muted-foreground">
        Suggested: <span className="font-medium text-foreground">{label}</span> (
        {suggestion.linksCount} linked debits)
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => onUse(suggestion.id)}>
        Use
      </Button>
    </div>
  );
}
