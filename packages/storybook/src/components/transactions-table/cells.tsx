import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  AccountCellProps,
  AmountCellProps,
  Business,
  CounterpartyCellProps,
  DebitDateCellProps,
  DescriptionCellProps,
  EventDateCellProps,
  SourceIdCellProps,
} from './types';

// Simple cn utility for combining classnames
const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// Counterparty Cell Component
export const CounterpartyCell: React.FC<CounterpartyCellProps> = ({ transaction, onChange }) => {
  const { counterparty, missingInfoSuggestions, sourceDescription, enableEdit } = transaction;

  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(sourceDescription || '');

  const hasSuggestion = !!missingInfoSuggestions?.business && enableEdit;
  const suggestedBusiness = hasSuggestion ? missingInfoSuggestions?.business : null;

  const displayName = counterparty?.name ?? (suggestedBusiness?.name || 'Missing');

  const handleBusinessClick = (businessId: string) => {
    console.log('Navigate to business transactions:', businessId);
  };

  const handleApproveSelection = () => {
    if (selectedBusiness || suggestedBusiness) {
      const businessToApprove = selectedBusiness || suggestedBusiness;
      console.log('Approve business:', businessToApprove);
      onChange?.();
      // Show similar transactions modal in real app
    }
  };

  const handleCreateBusiness = () => {
    console.log('Create new business with description:', searchTerm);
    onChange?.();
  };

  if (counterparty?.id) {
    return (
      <div className="flex flex-col justify-center">
        <button
          onClick={() => handleBusinessClick(counterparty.id)}
          className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-left"
        >
          {counterparty.name}
        </button>
      </div>
    );
  }

  if (!enableEdit) {
    return (
      <div className="flex flex-col justify-center">
        <span className="text-gray-500">{displayName}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="flex gap-1">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Choose or create a business"
              className="w-full px-3 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onFocus={() => setShowDropdown(true)}
            />
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="absolute right-1 top-1 p-1 hover:bg-gray-100 rounded"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleApproveSelection}
            disabled={!selectedBusiness && !suggestedBusiness}
            className="px-2"
          >
            <Check className="w-3 h-3" />
          </Button>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {suggestedBusiness && (
              <button
                onClick={() => {
                  setSelectedBusiness(suggestedBusiness);
                  setShowDropdown(false);
                  setSearchTerm(suggestedBusiness.name);
                }}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 text-blue-600 font-medium border-b"
              >
                ⭐ {suggestedBusiness.name} (Suggested)
              </button>
            )}

            {searchTerm && (
              <button
                onClick={handleCreateBusiness}
                className="w-full px-3 py-2 text-left hover:bg-green-50 text-green-600 font-medium"
              >
                + Create "{searchTerm}"
              </button>
            )}

            <div className="px-3 py-2 text-xs text-gray-500">
              Select a business or create a new one
            </div>
          </div>
        )}
      </div>

      {/* Show suggestion badge */}
      {hasSuggestion && (
        <div className="text-xs">
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
            AI Suggestion: {suggestedBusiness?.name}
          </span>
        </div>
      )}
    </div>
  );
};

// Event Date Cell Component
export const EventDateCell: React.FC<EventDateCellProps> = ({ transaction }) => {
  const { eventDate } = transaction;

  return (
    <div className="flex flex-col justify-center">
      <span className="text-sm">{eventDate ? format(new Date(eventDate), 'dd/MM/yy') : '-'}</span>
    </div>
  );
};

// Debit Date Cell Component
export const DebitDateCell: React.FC<DebitDateCellProps> = ({ transaction }) => {
  const { effectiveDate, sourceEffectiveDate } = transaction;

  return (
    <div className="flex flex-col justify-center">
      <span className="text-sm">
        {effectiveDate ? format(new Date(effectiveDate), 'dd/MM/yy') : '-'}
      </span>
      {sourceEffectiveDate &&
        effectiveDate &&
        new Date(sourceEffectiveDate).getTime() !== new Date(effectiveDate).getTime() && (
          <span className="text-xs text-gray-500">
            (Originally {format(new Date(sourceEffectiveDate), 'dd/MM/yy')})
          </span>
        )}
    </div>
  );
};

// Amount Cell Component
export const AmountCell: React.FC<AmountCellProps> = ({ transaction }) => {
  const { amount, cryptoExchangeRate } = transaction;

  const formatStringifyAmount = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="flex flex-col justify-center">
      <span
        className={cn(
          'text-sm font-medium whitespace-nowrap',
          Number(amount?.raw) > 0 ? 'text-green-700' : 'text-red-500',
        )}
      >
        {amount?.formatted || '-'}
      </span>

      {cryptoExchangeRate && amount?.raw && (
        <div className="text-xs text-gray-500 mt-1">
          <div>Rate: ${cryptoExchangeRate.rate.toLocaleString()}</div>
          <div className="font-medium">
            {formatStringifyAmount(amount.raw * cryptoExchangeRate.rate)}
          </div>
        </div>
      )}
    </div>
  );
};

// Account Cell Component
export const AccountCell: React.FC<AccountCellProps> = ({ transaction }) => {
  const { account } = transaction;

  return (
    <div className="flex flex-col justify-center">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{account.type}</span>
      <span className="text-sm font-medium">{account.name}</span>
    </div>
  );
};

// Description Cell Component
export const DescriptionCell: React.FC<DescriptionCellProps> = ({ transaction }) => {
  const { sourceDescription } = transaction;

  return (
    <div className="flex flex-col justify-center">
      <span className="text-sm">{sourceDescription || 'No description'}</span>
    </div>
  );
};

// Source ID Cell Component
export const SourceIdCell: React.FC<SourceIdCellProps> = ({ transaction }) => {
  const { referenceKey } = transaction;

  return (
    <div className="flex flex-col justify-center">
      <span className="text-sm font-mono text-gray-600">{referenceKey || '-'}</span>
    </div>
  );
};
