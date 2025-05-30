import { ReactElement, useMemo, useState } from 'react';
import {
  ChargeToMatchDocumentsFieldsFragmentDoc,
  DocumentsToChargeMatcherQuery,
  DocumentsToMatchFieldsFragment,
  DocumentsToMatchFieldsFragmentDoc,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { useUpdateDocument } from '../../../../hooks/use-update-document.js';
import { FormLabel } from '../../../ui/form.js';
import { Switch } from '../../../ui/switch.js';
import { Button } from '../../index.js';
import { StrictFilteredSelection } from './strict-filtered-selection.js';
import { WideFilteredSelection } from './wide-filtered-selection.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeToMatchDocumentsFields on Charge {
    id
    totalAmount {
      raw
      formatted
      currency
    }
    counterparty {
      id
      name
    }
    transactions {
      id
      eventDate
      sourceDescription
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DocumentsToMatchFields on Document {
    id
    __typename
    charge {
      id
    }
    image
    file
    documentType
    ... on FinancialDocument {
      creditor {
        id
        name
      }
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
  }
`;

interface Props {
  chargeProps: FragmentType<typeof ChargeToMatchDocumentsFieldsFragmentDoc>;
  documentsProps?: DocumentsToChargeMatcherQuery;
  // FragmentType<typeof DocumentsToMatchFieldsFragmentDoc>;
  onDone: () => void;
}

export function SelectionHandler({ chargeProps, documentsProps, onDone }: Props): ReactElement {
  const charge = getFragmentData(ChargeToMatchDocumentsFieldsFragmentDoc, chargeProps);
  const documents = useMemo(
    () =>
      documentsProps?.documentsByFilters.map(d =>
        getFragmentData(DocumentsToMatchFieldsFragmentDoc, d),
      ) ?? [],
    [documentsProps],
  );

  const [selectedDocuments, setSelectedDocuments] = useState<Array<string>>([]);
  const { updateDocument } = useUpdateDocument();

  const coarsedFilteredDocuments = useMemo(
    () =>
      (
        documents.filter(document => {
          if (
            document.charge ||
            document.__typename === 'Unprocessed' ||
            document.__typename === 'OtherDocument' ||
            document.amount?.raw == null ||
            !document.date
          ) {
            return false;
          }
          return true;
        }) as Exclude<
          DocumentsToMatchFieldsFragment,
          { __typename: 'Unprocessed' } | { __typename: 'OtherDocument' }
        >[]
      ).sort((a, b) => {
        if (a.date ?? (b.date ?? '') > '') return 1;
        if (a.date ?? (b.date ?? '') < '') return -1;
        return 0;
      }),
    [documents],
  );

  const strictFilteredDocuments = useMemo(
    () =>
      coarsedFilteredDocuments.filter(document => {
        if (document.charge || document.amount?.raw == null || !document.date) {
          return false;
        }

        const chargeAmount = Math.abs(charge.totalAmount!.raw);
        const documentAmount = Math.abs(document.amount.raw);
        const chargeDate = new Date(charge.transactions[0].eventDate).getTime();
        const documentDate = new Date(document.date).getTime();

        const fee = documentAmount > 3000 ? 30 : 0;

        return (
          documentAmount >= Math.floor(chargeAmount) &&
          documentAmount <= Math.ceil(chargeAmount + fee) &&
          Math.abs(documentDate - chargeDate) < 5_184_000_000
        );
      }),
    [coarsedFilteredDocuments, charge],
  );

  const [filterSuggestions, setFilterSuggestions] = useState(strictFilteredDocuments.length > 0);

  if (coarsedFilteredDocuments.length === 0) {
    return <p>No matches found</p>;
  }

  function toggleDocument(documentId: string): void {
    if (selectedDocuments.includes(documentId)) {
      setSelectedDocuments(selectedDocuments.filter(id => id !== documentId));
    } else {
      setSelectedDocuments([...selectedDocuments, documentId]);
    }
  }

  const onExecuteMatch = (): void => {
    selectedDocuments.map(documentId =>
      updateDocument({
        documentId,
        fields: { chargeId: charge.id },
      }),
    );
    onDone();
  };

  return (
    <div className="relative items-center w-full mx-auto md:px-5 lg:px-2 max-w-8xl">
      <div className="flex flex-row justify-end">
        {strictFilteredDocuments.length > 0 && (
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <FormLabel>Filter Suggestions</FormLabel>
            </div>
            <Switch checked={filterSuggestions} onCheckedChange={setFilterSuggestions} />
          </div>
        )}
        <Button title="Accept" disabled={selectedDocuments.length === 0} onClick={onExecuteMatch} />
      </div>
      <div>
        {filterSuggestions ? (
          <StrictFilteredSelection
            charge={charge}
            documents={strictFilteredDocuments}
            toggleDocument={toggleDocument}
            selectedDocuments={selectedDocuments}
          />
        ) : (
          <WideFilteredSelection
            charge={charge}
            documents={coarsedFilteredDocuments}
            toggleDocument={toggleDocument}
            selectedDocuments={selectedDocuments}
          />
        )}
      </div>
    </div>
  );
}
