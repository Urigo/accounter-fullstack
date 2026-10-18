import { useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react';
import { ArrowRight } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import { EditDocumentDocument, type UpdateDocumentFieldsInput } from '../../../gql/graphql.js';
import { relevantDataPicker, type MakeBoolean } from '../../../helpers/form.js';
import { KEYBOARD_RANK } from '../../../hooks/use-document-viewer.js';
import { usePersistentState } from '../../../hooks/use-persistent-state.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { AccounterSpinner } from '../../ui/accounter-spinner.js';
import { Form } from '../../ui/form.js';
import { DocumentViewer } from '../document-viewer/document-viewer.js';
import { DocumentEditSplit } from '../document-viewer/edit-split-layout.js';
import { EDIT_PANE_HIDDEN_KEY, reviveBoolean } from '../document-viewer/persisted-sizes.js';
import { previewImageUrl, toDocumentViewerEntry } from '../document-viewer/source.js';
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

/** How long the Image URL field must hold still before the viewer loads it. */
export const IMAGE_PREVIEW_DEBOUNCE_MS = 400;

interface Props {
  documentId: string;
  onDone: () => void;
  onChange: () => void;
  /** The source list's document ids, in order. With `onNavigate`, enables Save & next. */
  siblingIds?: string[];
  /** Shows another document in the same sheet, after Save & next saved this one. */
  onNavigate?: (documentId: string) => void;
}

/** The id after `documentId` in `siblingIds`; `null` on the last one or when it isn't listed. */
export function nextSiblingId(
  siblingIds: readonly string[] | undefined,
  documentId: string,
): string | null {
  const index = siblingIds?.indexOf(documentId) ?? -1;
  return index === -1 ? null : (siblingIds?.[index + 1] ?? null);
}

/**
 * The form grid's column count: one in a narrow pane (the split's 320px minimum can't fit two),
 * two beside the viewer, four once the viewer is hidden.
 */
export function formColumns(narrow: boolean, viewerHidden: boolean): number {
  if (narrow) {
    return 1;
  }
  return viewerHidden ? 4 : 2;
}

/** `value`, once it has held still for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export const EditDocument = ({
  documentId,
  onDone,
  onChange,
  siblingIds,
  onNavigate,
}: Props): ReactElement => {
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
  /** The viewer pane collapsed to a strip. Remembered per browser. */
  const [viewerHidden, setViewerHidden] = usePersistentState(
    EDIT_PANE_HIDDEN_KEY,
    false,
    reviveBoolean,
  );

  const { updateDocument, fetching } = useUpdateDocument();
  /** Save & next awaits its save, so it holds the buttons for the round trip. */
  const [savingNext, setSavingNext] = useState(false);
  /**
   * Set synchronously on click, before react-hook-form's async validation runs, so a double click
   * can't start a second save before `savingNext` disables the button.
   */
  const savingNextRef = useRef(false);
  /**
   * Whether the sheet is still showing this document. A save that resolves after the sheet closed
   * (or moved on) must not navigate: that would reopen it on the next document.
   */
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const nextId = onNavigate ? nextSiblingId(siblingIds, documentId) : null;

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

  const onSaveAndNext: SubmitHandler<UpdateDocumentFieldsInput> = async data => {
    if (!document || !nextId || !onNavigate) {
      return;
    }
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      const result = await updateDocument({ documentId, fields: dataToUpdate });
      // A failed save resolves empty, and the hook has already shown its toast: stay here, with
      // the edits intact, so they can be fixed and saved again.
      if (!result) {
        return;
      }
      // The save went through, so the list refreshes even if the sheet closed meanwhile.
      onChange();
    }
    if (mountedRef.current) {
      onNavigate(nextId);
    }
  };

  const onSaveAndNextClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (savingNextRef.current) {
      return;
    }
    savingNextRef.current = true;
    setSavingNext(true);
    void handleSubmit(onSaveAndNext)(event).finally(() => {
      savingNextRef.current = false;
      if (mountedRef.current) {
        setSavingNext(false);
      }
    });
  };

  const amountCurrency = watch('amount.currency');
  // The viewer follows the Image URL field once it holds still and parses as an http(s) URL.
  const typedImage = useDebouncedValue(watch('image'), IMAGE_PREVIEW_DEBOUNCE_MS);

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

  const storedSource = toDocumentViewerEntry(document);
  const viewerSource = {
    ...storedSource,
    imageUrl: previewImageUrl(typedImage, storedSource.imageUrl),
  };
  const dirty = Object.keys(dirtyFields).length > 0;
  const busy = fetching || savingNext;

  return (
    <DocumentEditSplit
      entry={viewerSource}
      hidden={viewerHidden}
      onHiddenChange={setViewerHidden}
      form={({ narrow }) => (
        <Form {...formManager}>
          <form onSubmit={handleSubmit(onSubmit)} className="px-5 pt-1">
            {/* The grid's breakpoints follow the viewport, not this pane, so the column count
                follows the pane instead: one when it is narrow, two beside the viewer, four once
                the viewer is hidden. */}
            <SimpleGrid cols={formColumns(narrow, viewerHidden)}>
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
            <div className="sticky bottom-0 flex justify-center gap-2 bg-white py-4 dark:bg-gray-950">
              <Button type="submit" variant="default" disabled={busy || !dirty}>
                Save
              </Button>
              {onNavigate && siblingIds && (
                // Disabled on the last document, when this one isn't in the list, when nothing
                // changed, and while a save is in flight.
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !dirty || !nextId}
                  onClick={onSaveAndNextClick}
                >
                  Save &amp; next
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </form>
        </Form>
      )}
      viewer={({ onHide, onToggleExpand, expanded }) => (
        <DocumentViewer
          source={viewerSource}
          // A new image URL, typed or saved, restarts the canvas (rotation included), as a new
          // document does.
          documentKey={`${document.id}:${viewerSource.imageUrl ?? ''}`}
          closeVariant="hide"
          onClose={onHide}
          onToggleExpand={onToggleExpand}
          expanded={expanded}
          // No stepper here: stepping the sheet would drop unsaved edits. Save & next steps.
          // Hidden, the pane gives up the keys, so `+`, `0`, `R` and `M` aren't swallowed for nothing.
          keyboardRank={viewerHidden ? null : KEYBOARD_RANK.embedded}
        />
      )}
    />
  );
};
