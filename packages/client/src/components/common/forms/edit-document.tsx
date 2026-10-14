import { useEffect, useState, type ReactElement } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import { EditDocumentDocument, type UpdateDocumentFieldsInput } from '../../../gql/graphql.js';
import { relevantDataPicker, type MakeBoolean } from '../../../helpers/form.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { AccounterSpinner } from '../../ui/accounter-spinner.js';
import { Form } from '../../ui/form.js';
import { DocumentViewer } from '../document-viewer/document-viewer.js';
import { DocumentEditSplit } from '../document-viewer/edit-split-layout.js';
import { toDocumentViewerEntry } from '../document-viewer/source.js';
import { SimpleGrid } from '../simple-grid.js';
import { ModifyDocumentFields } from './modify-document-fields.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditDocument($documentId: UUID!) {
    documentById(documentId: $documentId) {
      id
      image
      file
      documentType
      description
      remarks
      __typename
      ... on FinancialDocument {
        vat {
          raw
          currency
        }
        serialNumber
        date
        amount {
          raw
          currency
        }
        debtor {
          id
          name
        }
        creditor {
          id
          name
        }
        vatReportDateOverride
        noVatAmount
        allocationNumber
        exchangeRateOverride
      }
      ... on Unprocessed {
        vat {
          raw
          currency
        }
        serialNumber
        date
        amount {
          raw
          currency
        }
        debtor {
          id
          name
        }
        creditor {
          id
          name
        }
        vatReportDateOverride
        noVatAmount
        allocationNumber
        exchangeRateOverride
      }
      ... on OtherDocument {
        vat {
          raw
          currency
        }
        serialNumber
        date
        amount {
          raw
          currency
        }
        debtor {
          id
          name
        }
        creditor {
          id
          name
        }
        vatReportDateOverride
        noVatAmount
        allocationNumber
        exchangeRateOverride
      }
    }
  }
`;

interface Props {
  documentId: string;
  onDone: () => void;
  onChange: () => void;
}

export const EditDocument = ({ documentId, onDone, onChange }: Props): ReactElement => {
  const [{ data: documentData, fetching: fetchingDocument }] = useQuery({
    query: EditDocumentDocument,
    variables: {
      documentId,
    },
  });

  const document = documentData?.documentById;
  const formManager = useForm<UpdateDocumentFieldsInput>({ defaultValues: { ...document } });
  const {
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    watch,
  } = formManager;
  /** The viewer pane collapsed to a strip. In memory only until PR 5 persists it. */
  const [viewerHidden, setViewerHidden] = useState<boolean>(false);

  const { updateDocument, fetching } = useUpdateDocument();

  const onSubmit: SubmitHandler<UpdateDocumentFieldsInput> = data => {
    if (!document) {
      return;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    onDone?.();
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateDocument({
        documentId,
        fields: dataToUpdate,
      }).then(onChange);
    }
  };

  const amountCurrency = watch('amount.currency');

  // auto update vat currency according to amount currency
  useEffect(() => {
    setValue('vat.currency', amountCurrency);
  }, [setValue, amountCurrency]);

  if (fetchingDocument || !document) {
    return (
      <div className="flex justify-center">
        {fetchingDocument && <AccounterSpinner className="my-5" />}
      </div>
    );
  }

  const viewerSource = toDocumentViewerEntry(document);

  return (
    <DocumentEditSplit
      hidden={viewerHidden}
      onHiddenChange={setViewerHidden}
      form={
        <Form {...formManager}>
          <form onSubmit={handleSubmit(onSubmit)} className="px-5 pt-1">
            {/* The grid's breakpoints follow the viewport, not this pane, so the column count
                follows the viewer instead: two beside it, four once it is hidden. */}
            <SimpleGrid cols={viewerHidden ? 4 : 2}>
              <ModifyDocumentFields document={document} formManager={formManager} />

              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Link
                  to={document.file?.toString() || ''}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center mt-5"
                >
                  <Button variant="outline" className="w-full mb-2">
                    Open File
                  </Button>
                </Link>
              </div>
            </SimpleGrid>
            {/* Sticky, so Save stays reachable however far the form pane scrolls. */}
            <div className="sticky bottom-0 flex justify-center bg-white py-4 dark:bg-gray-950">
              <Button
                type="submit"
                variant="default"
                disabled={fetching || Object.keys(dirtyFields).length === 0}
              >
                Save
              </Button>
            </div>
          </form>
        </Form>
      }
      viewer={({ onHide, onToggleExpand, expanded }) => (
        <DocumentViewer
          source={viewerSource}
          // A new image URL restarts the canvas, as a new document does.
          documentKey={`${document.id}:${viewerSource.imageUrl ?? ''}`}
          closeVariant="hide"
          onClose={onHide}
          onToggleExpand={onToggleExpand}
          expanded={expanded}
        />
      )}
    />
  );
};
