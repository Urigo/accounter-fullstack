import { type JSX } from 'react';
import { FinancePreferences } from '../finance-preferences.js';

export function FinanceTab(): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-slate-800">
          Finance Preferences
        </h3>
        <p className="text-sm text-slate-500">
          Currency defaults, aging thresholds, and billing configuration
        </p>
      </div>
      <FinancePreferences />
    </div>
  );
}
