import { useState } from 'react';
import { useQuery } from 'urql';
import { ChargeExtendedInfoForChargeMatchesDocument } from '@/gql/graphql.js';
import { type Row } from '@tanstack/react-table';
import { TableSkeleton } from '../common/index.js';
import { DocumentsTable } from '../documents-table/index.js';
import { TransactionsTable } from '../transactions-table/index.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion.js';
import type { ChargeMatchRow } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeExtendedInfoForChargeMatches($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      transactions {
        id
        ...TransactionForTransactionsTableFields
      }
      additionalDocuments {
        id
        ...TableDocumentsRowFields
      }
    }
  }
`;

interface Props {
  row: Row<ChargeMatchRow>;
}

export function ChargeMatchesRowExtensions({ row }: Props) {
  const [openSections, setOpenSections] = useState<string[]>([]);

  const [{ data: chargeData, fetching: fetchingData }] = useQuery({
    query: ChargeExtendedInfoForChargeMatchesDocument,
    variables: {
      chargeId: row.original.id ?? '',
    },
    pause: !row.original.id,
  });

  const transactions = chargeData?.charge.transactions;
  const documents = chargeData?.charge.additionalDocuments;

  return (
    <Accordion
      type="multiple"
      value={openSections}
      onValueChange={setOpenSections}
      className="space-y-4"
    >
      {/* Transactions */}
      <AccordionItem value="transactions" className="rounded-lg border-2">
        <div className="px-2 bg-gray-600/10 rounded-t-lg">
          <AccordionTrigger className="hover:no-underline p-2">
            <h3 className="font-semibold text-lg">Transactions</h3>
          </AccordionTrigger>
        </div>
        {fetchingData ? (
          <AccordionContent>
            <div className="p-2">
              <TableSkeleton />
            </div>
          </AccordionContent>
        ) : (
          <AccordionContent>
            {transactions && (
              <div className="p-2">
                <TransactionsTable transactionsProps={transactions} />
              </div>
            )}
          </AccordionContent>
        )}
      </AccordionItem>

      {/* Documents */}
      <AccordionItem value="documents" className="rounded-lg border-2">
        <div className="px-2 bg-gray-600/10 rounded-t-lg">
          <AccordionTrigger className="hover:no-underline p-2">
            <h3 className="font-semibold text-lg">Documents</h3>
          </AccordionTrigger>
        </div>
        {fetchingData ? (
          <AccordionContent>
            <div className="p-2">
              <TableSkeleton />
            </div>
          </AccordionContent>
        ) : (
          <AccordionContent>
            {documents && (
              <div className="p-2">
                <DocumentsTable documentsProps={documents} />
              </div>
            )}
          </AccordionContent>
        )}
      </AccordionItem>
    </Accordion>
  );
}
