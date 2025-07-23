import React, { useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Check, File, Image } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  AmountCellProps,
  CreditorCellProps,
  DateCellProps,
  DebtorCellProps,
  DocumentValidation,
  FilesCellProps,
  SerialCellProps,
  TypeCellProps,
  VatCellProps,
} from './types';

// Simple cn utility for combining classnames
const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// Error indicator component
const ErrorIndicator: React.FC<{ hasError: boolean; children: React.ReactNode }> = ({
  hasError,
  children,
}) => (
  <div className="relative">
    {hasError && (
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full border border-white shadow-sm"></div>
    )}
    {children}
  </div>
);

// Suggestion button component
const SuggestionButton: React.FC<{ onAccept: () => void; disabled?: boolean }> = ({
  onAccept,
  disabled,
}) => (
  <Button
    size="sm"
    variant="outline"
    className="ml-2 h-6 w-6 p-0"
    onClick={onAccept}
    disabled={disabled}
  >
    <Check className="w-3 h-3" />
  </Button>
);

// Amount Cell Component
export const AmountCell: React.FC<AmountCellProps> = ({ document }) => {
  const dbAmount = document.amount;
  const suggestedAmount = document.missingInfoSuggestions?.amount;
  const hasAlternative = !dbAmount && !!suggestedAmount;
  const amount = dbAmount ?? suggestedAmount;

  const shouldHaveAmount = DocumentValidation.shouldHaveAmount(document.documentType);
  const isError = shouldHaveAmount && amount?.formatted == null;

  const handleAcceptSuggestion = () => {
    console.log('Accept suggested amount:', suggestedAmount);
    document.onUpdate();
  };

  return (
    <div className="flex items-center">
      <ErrorIndicator hasError={isError}>
        <p
          className={cn(
            'whitespace-nowrap',
            hasAlternative && 'bg-yellow-100 px-1 rounded',
            Number(amount?.raw) > 0 ? 'text-green-700' : 'text-red-500',
          )}
        >
          {amount?.formatted || 'Missing'}
        </p>
      </ErrorIndicator>
      {hasAlternative && <SuggestionButton onAccept={handleAcceptSuggestion} />}
    </div>
  );
};

// Date Cell Component
export const DateCell: React.FC<DateCellProps> = ({ document }) => {
  const date = document.date;
  const shouldHaveDate = DocumentValidation.shouldHaveDate(document.documentType);
  const isError = shouldHaveDate && !date;

  const formattedDate = date ? format(new Date(date), 'dd/MM/yy') : 'Missing Data';
  const dateContentValue = shouldHaveDate ? formattedDate : null;

  return (
    <ErrorIndicator hasError={isError}>
      <div>{dateContentValue}</div>
    </ErrorIndicator>
  );
};

// Type Cell Component
export const TypeCell: React.FC<TypeCellProps> = ({ document }) => {
  const isError = !document.documentType || DocumentValidation.isUnprocessed(document.documentType);
  const cellText = document.documentType ?? 'Missing';

  return (
    <ErrorIndicator hasError={isError}>
      <Badge
        variant={isError ? 'destructive' : 'secondary'}
        className={isError ? 'bg-red-100 text-red-800' : ''}
      >
        {cellText}
      </Badge>
    </ErrorIndicator>
  );
};

// Serial Cell Component
export const SerialCell: React.FC<SerialCellProps> = ({ document }) => {
  const serialNumber = document.serialNumber;
  const allocationNumber = document.allocationNumber;

  const shouldHaveSerial = DocumentValidation.shouldHaveSerial(document.documentType);
  const isError = shouldHaveSerial && !serialNumber;

  return (
    <div className="flex flex-col items-center justify-center">
      <ErrorIndicator hasError={isError}>
        <p>{serialNumber || 'Missing'}</p>
      </ErrorIndicator>
      {allocationNumber && <p className="text-xs text-gray-500">({allocationNumber})</p>}
    </div>
  );
};

// VAT Cell Component
export const VatCell: React.FC<VatCellProps> = ({ document }) => {
  const vat = document.vat;
  const shouldHaveVat = DocumentValidation.shouldHaveVat(document.documentType);
  const isError = shouldHaveVat && vat?.formatted == null;

  return (
    <ErrorIndicator hasError={isError}>
      <div
        className={cn(
          'whitespace-nowrap',
          Number(vat?.raw) > 0 ? 'text-green-700' : 'text-red-500',
        )}
      >
        {vat?.formatted || 'Missing'}
      </div>
    </ErrorIndicator>
  );
};

// Files Cell Component
export const FilesCell: React.FC<FilesCellProps> = ({ document }) => {
  const [openImage, setOpenImage] = useState(false);

  return (
    <div className="flex gap-1">
      <ErrorIndicator hasError={!document.image}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!document.image}
          onClick={() => setOpenImage(true)}
        >
          <Image className="h-4 w-4" />
        </Button>
      </ErrorIndicator>

      <ErrorIndicator hasError={!document.file}>
        {document.file ? (
          <a
            href={typeof document.file === 'string' ? document.file : document.file.href}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <File className="h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
            <File className="h-4 w-4" />
          </Button>
        )}
      </ErrorIndicator>

      {/* Simple image modal */}
      {openImage && document.image && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setOpenImage(false)}
        >
          <div className="max-w-3xl max-h-full p-4">
            <img
              src={document.image}
              alt="Document"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Business cell helper
const BusinessCell: React.FC<{
  business?: { id: string; name: string } | null;
  suggestedBusiness?: { id: string; name: string } | null;
  hasError: boolean;
  onAcceptSuggestion?: () => void;
}> = ({ business, suggestedBusiness, hasError, onAcceptSuggestion }) => {
  const hasAlternative = !business && !!suggestedBusiness;
  const displayBusiness = business ?? suggestedBusiness;

  const handleBusinessClick = () => {
    if (displayBusiness?.id) {
      console.log('Navigate to business:', displayBusiness.id);
    }
  };

  const handleAcceptSuggestion = () => {
    console.log('Accept suggested business:', suggestedBusiness);
    onAcceptSuggestion?.();
  };

  return (
    <div className="flex items-center">
      <ErrorIndicator hasError={hasError}>
        {displayBusiness?.id ? (
          <button
            onClick={handleBusinessClick}
            className={cn(
              'text-blue-600 hover:text-blue-800 hover:underline font-semibold text-left',
              hasAlternative && 'bg-yellow-100 px-1 rounded',
            )}
          >
            {displayBusiness.name}
          </button>
        ) : (
          <span className={hasError ? 'bg-yellow-100 px-1 rounded' : ''}>
            {displayBusiness?.name || 'Missing'}
          </span>
        )}
      </ErrorIndicator>
      {hasAlternative && <SuggestionButton onAccept={handleAcceptSuggestion} />}
    </div>
  );
};

// Creditor Cell Component
export const CreditorCell: React.FC<CreditorCellProps> = ({ document }) => {
  const dbCreditor = document.creditor;
  const shouldHaveCreditor = DocumentValidation.shouldHaveCreditor(document.documentType);
  const isError =
    (shouldHaveCreditor && !dbCreditor?.id) ||
    DocumentValidation.isUnprocessed(document.documentType);

  // Determine suggested creditor based on logic
  const suggestedCreditor = React.useMemo(() => {
    if (dbCreditor || !document.missingInfoSuggestions) {
      return undefined;
    }
    const { owner, counterparty, isIncome } = document.missingInfoSuggestions;

    if (isIncome != null) {
      return isIncome ? owner : counterparty;
    }
    return counterparty; // Default fallback
  }, [document, dbCreditor]);

  const handleAcceptSuggestion = () => {
    document.onUpdate();
  };

  if (!shouldHaveCreditor) return null;

  return (
    <BusinessCell
      business={dbCreditor}
      suggestedBusiness={suggestedCreditor}
      hasError={isError}
      onAcceptSuggestion={handleAcceptSuggestion}
    />
  );
};

// Debtor Cell Component
export const DebtorCell: React.FC<DebtorCellProps> = ({ document }) => {
  const dbDebtor = document.debtor;
  const shouldHaveDebtor = DocumentValidation.shouldHaveDebtor(document.documentType);
  const isError =
    (shouldHaveDebtor && !dbDebtor?.id) || DocumentValidation.isUnprocessed(document.documentType);

  // Determine suggested debtor based on logic
  const suggestedDebtor = React.useMemo(() => {
    if (dbDebtor || !document.missingInfoSuggestions) {
      return undefined;
    }
    const { owner, counterparty, isIncome } = document.missingInfoSuggestions;

    if (isIncome != null) {
      return isIncome ? counterparty : owner;
    }
    return owner; // Default fallback
  }, [document, dbDebtor]);

  const handleAcceptSuggestion = () => {
    document.onUpdate();
  };

  if (!shouldHaveDebtor) return null;

  return (
    <BusinessCell
      business={dbDebtor}
      suggestedBusiness={suggestedDebtor}
      hasError={isError}
      onAcceptSuggestion={handleAcceptSuggestion}
    />
  );
};
