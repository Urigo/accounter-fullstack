import { type ReactElement } from 'react';
import type { ChargeMatchCardFieldsFragment } from '../../gql/graphql.js';
import { Score } from '../common/index.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { chargeDate } from './utils.js';

type Props = {
  charge: ChargeMatchCardFieldsFragment;
  /** Match confidence (0..1). When provided, a score badge is rendered */
  confidenceScore?: number;
  title: string;
};

function Field({ label, value }: { label: string; value?: string | null }): ReactElement | null {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export const ChargeDetailCard = ({ charge, confidenceScore, title }: Props): ReactElement => {
  const documentWithImage = charge.additionalDocuments.find(doc => doc.image);
  const documentTypes = [
    ...new Set(charge.additionalDocuments.map(doc => doc.documentType).filter(Boolean)),
  ].join(', ');
  const hasExtensions = charge.transactions.length > 0 || charge.miscExpenses.length > 0;

  return (
    <Card data-testid="charge-detail-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {confidenceScore != null && (
          <div
            className="flex items-center gap-2"
            aria-label={`Match confidence score: ${Math.round(confidenceScore * 100)}%`}
          >
            <Score value={Math.round(confidenceScore * 100)} size="sm" />
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" value={chargeDate(charge)} />
          {/* Exact server-formatted amount with its currency symbol, no conversion */}
          <Field label="Amount" value={charge.totalAmount?.formatted} />
          <Field label="Counterparty" value={charge.counterparty?.name} />
          <Field label="Document type" value={documentTypes} />
        </div>
        <Field label="Description" value={charge.userDescription} />

        {documentWithImage?.image ? (
          <a
            href={documentWithImage.file?.toString() ?? documentWithImage.image.toString()}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={documentWithImage.image.toString()}
              alt="Document preview"
              className="max-h-56 w-auto rounded-md border object-contain"
            />
          </a>
        ) : (
          <p className="text-xs text-gray-400">No document preview</p>
        )}

        {hasExtensions && (
          <Accordion type="single" collapsible>
            <AccordionItem value="more-details">
              <AccordionTrigger className="text-sm">More Details</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                {charge.transactions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-500">Transactions</span>
                    <ul className="flex flex-col gap-1">
                      {charge.transactions.map(transaction => (
                        <li key={transaction.id} className="flex justify-between gap-2 text-sm">
                          <span className="truncate">
                            {transaction.eventDate} · {transaction.sourceDescription}
                          </span>
                          <span className="shrink-0 font-medium">
                            {transaction.amount.formatted}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {charge.miscExpenses.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-500">Misc Expenses</span>
                    <ul className="flex flex-col gap-1">
                      {charge.miscExpenses.map(expense => (
                        <li key={expense.id} className="flex justify-between gap-2 text-sm">
                          <span className="truncate">{expense.description ?? 'Misc expense'}</span>
                          <span className="shrink-0 font-medium">{expense.amount.formatted}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};
