import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Bitcoin,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  CreditCard,
  Edit2,
  ExternalLink,
  Hash,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { AccountType, Business, TransactionsTableProps, TransactionsTableRowType } from './types';

// Account type to icon mapping
const getAccountIcon = (type: AccountType) => {
  switch (type) {
    case AccountType.BankAccount:
      return <Building2 className="w-4 h-4" />;
    case AccountType.CreditCard:
      return <CreditCard className="w-4 h-4" />;
    case AccountType.CryptoWallet:
      return <Bitcoin className="w-4 h-4" />;
    case AccountType.Cash:
      return <Wallet className="w-4 h-4" />;
    default:
      return <Building2 className="w-4 h-4" />;
  }
};

// Account type to color mapping
const getAccountColor = (type: AccountType) => {
  switch (type) {
    case AccountType.BankAccount:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case AccountType.CreditCard:
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case AccountType.CryptoWallet:
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case AccountType.Cash:
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Transaction Card Component
const TransactionCard: React.FC<{
  transaction: TransactionsTableRowType;
  onCounterpartyUpdate?: () => void;
}> = ({ transaction, onCounterpartyUpdate }) => {
  const {
    counterparty,
    eventDate,
    effectiveDate,
    amount,
    account,
    sourceDescription,
    referenceKey,
    cryptoExchangeRate,
    missingInfoSuggestions,
    enableEdit,
    enableChargeLink,
    editTransaction,
    chargeId,
  } = transaction;

  const [showCounterpartyDropdown, setShowCounterpartyDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(sourceDescription || '');

  const isIncome = amount && amount.raw > 0;
  const hasSuggestion = !!missingInfoSuggestions?.business && enableEdit;
  const suggestedBusiness = hasSuggestion ? missingInfoSuggestions?.business : null;

  const formatStringifyAmount = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleApproveSelection = () => {
    console.log('Approve business:', suggestedBusiness);
    onCounterpartyUpdate?.();
  };

  const handleBusinessClick = (businessId: string) => {
    console.log('Navigate to business:', businessId);
  };

  return (
    <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6 mb-3">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        {/* Counterparty Section */}
        <div className="flex-1 min-w-0">
          {counterparty?.id ? (
            <button
              onClick={() => handleBusinessClick(counterparty.id)}
              className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              {counterparty.name}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Select counterparty..."
                  className="text-lg font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {suggestedBusiness && (
                  <Button
                    size="sm"
                    onClick={handleApproveSelection}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Use "{suggestedBusiness.name}"
                  </Button>
                )}
              </div>
              {hasSuggestion && (
                <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                  💡 AI suggests: <strong>{suggestedBusiness?.name}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount Section */}
        <div className="text-right">
          <div className={`text-2xl font-bold ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
            {amount?.formatted || '-'}
          </div>
          {cryptoExchangeRate && amount?.raw && (
            <div className="text-sm text-gray-500 mt-1">
              <div>Rate: ${cryptoExchangeRate.rate.toLocaleString()}</div>
              <div className="font-medium text-gray-700">
                ≈ {formatStringifyAmount(amount.raw * cryptoExchangeRate.rate)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Account Info */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${getAccountColor(account.type)}`}>
            {getAccountIcon(account.type)}
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {account.type}
            </div>
            <div className="font-medium text-gray-900">{account.name}</div>
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-gray-500">Event</div>
              <div className="font-medium">
                {eventDate ? format(new Date(eventDate), 'dd/MM/yy') : '-'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-gray-500">Debit</div>
              <div className="font-medium">
                {effectiveDate ? format(new Date(effectiveDate), 'dd/MM/yy') : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Reference & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Hash className="w-4 h-4 text-gray-400" />
            <span className="font-mono text-gray-600">{referenceKey || '-'}</span>
          </div>

          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {enableEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={editTransaction}
                className="p-2 h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}

            {enableChargeLink && chargeId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => console.log('Navigate to charge:', chargeId)}
                className="p-2 h-8 w-8 hover:bg-green-50 hover:text-green-600"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {sourceDescription && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border-l-4 border-blue-200">
          {sourceDescription}
        </div>
      )}
    </div>
  );
};

// Main Monday-style Transactions Table
export const MondayTransactionsTable: React.FC<TransactionsTableProps> = ({
  data,
  enableEdit = false,
  enableChargeLink = false,
  onChange,
}) => {
  // Group transactions by date or status
  const [groupBy, setGroupBy] = useState<'date' | 'account' | 'none'>('date');

  const enhancedData = data.map(transaction => ({
    ...transaction,
    enableEdit: transaction.enableEdit ?? enableEdit,
    enableChargeLink: transaction.enableChargeLink ?? enableChargeLink,
  }));

  // Group data
  const groupedData = React.useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Transactions': enhancedData };
    }

    if (groupBy === 'account') {
      return enhancedData.reduce(
        (groups, transaction) => {
          const key = transaction.account.name;
          if (!groups[key]) groups[key] = [];
          groups[key].push(transaction);
          return groups;
        },
        {} as Record<string, TransactionsTableRowType[]>,
      );
    }

    // Group by date
    return enhancedData.reduce(
      (groups, transaction) => {
        const date = transaction.eventDate
          ? format(new Date(transaction.eventDate), 'MMMM yyyy')
          : 'No Date';
        if (!groups[date]) groups[date] = [];
        groups[date].push(transaction);
        return groups;
      },
      {} as Record<string, TransactionsTableRowType[]>,
    );
  }, [enhancedData, groupBy]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <div className="flex gap-2">
            <Button
              variant={groupBy === 'date' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupBy('date')}
            >
              By Date
            </Button>
            <Button
              variant={groupBy === 'account' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupBy('account')}
            >
              By Account
            </Button>
            <Button
              variant={groupBy === 'none' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupBy('none')}
            >
              All
            </Button>
          </div>
        </div>

        <div className="text-gray-600">
          {enhancedData.length} transactions • {Object.keys(groupedData).length} groups
        </div>
      </div>

      {/* Groups */}
      {Object.entries(groupedData).map(([groupName, transactions]) => (
        <div key={groupName} className="mb-8">
          <div className="flex items-center gap-3 mb-4 sticky top-0 bg-gray-50 py-2 z-10">
            <ChevronDown className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">{groupName}</h2>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
              {transactions.length}
            </span>
          </div>

          <div className="space-y-2">
            {transactions.map(transaction => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onCounterpartyUpdate={onChange}
              />
            ))}
          </div>
        </div>
      ))}

      {enhancedData.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No transactions found</div>
          <div className="text-gray-500">Add some transactions to get started!</div>
        </div>
      )}
    </div>
  );
};
