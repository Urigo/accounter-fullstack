import { useMemo, useState } from 'react';
import { Switch } from '@mantine/core';
import { Button } from '../../';
import { FragmentType, getFragmentData } from '../../../../gql';
import {
  ChargeToMatchDocumentsFieldsFragmentDoc,
  DocumentsToChargeMatcherQuery,
  DocumentsToMatchFieldsFragment,
  DocumentsToMatchFieldsFragmentDoc,
} from '../../../../gql/graphql';
import { useUpdateDocument } from '../../../../hooks/use-update-document';
import { StrictFilteredSelection } from './strict-filtered-selection';
import { WideFilteredSelection } from './wide-filtered-selection';

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
    creditor {
      id
      name
    }
    ... on Proforma {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on InvoiceReceipt {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on Invoice {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
    }
    ... on Receipt {
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

export function SelectionHandler({ chargeProps, documentsProps, onDone }: Props) {
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
            document.amount?.raw == null ||
            !document.date
          ) {
            return false;
          }
          return true;
        }) as Exclude<DocumentsToMatchFieldsFragment, { __typename: 'Unprocessed' }>[]
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

  function toggleDocument(documentId: string) {
    if (selectedDocuments.includes(documentId)) {
      setSelectedDocuments(selectedDocuments.filter(id => id !== documentId));
    } else {
      setSelectedDocuments([...selectedDocuments, documentId]);
    }
  }

  const onExecuteMatch = () => {
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
          <Switch
            checked={filterSuggestions}
            onChange={() => setFilterSuggestions(!filterSuggestions)}
            label="Filter Suggestions"
          />
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
