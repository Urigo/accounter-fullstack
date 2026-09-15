import { useEffect, useState, type ReactElement } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import { EditDocumentDocument, type UpdateDocumentFieldsInput } from '../../../gql/graphql.js';
import { relevantDataPicker, type MakeBoolean } from '../../../helpers/form.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { Form } from '../../ui/form.js';
import { Spinner } from '../../ui/spinner.js';
import { DocumentImageDrawer, SimpleGrid } from '../index.js';
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
  const [openImage, setOpenImage] = useState<boolean>(false);

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

  return (
    <div className="flex flex-row">
      {fetchingDocument && <Spinner className="my-5 size-14 self-center text-gray-900" />}
      {!fetchingDocument && document && (
        <>
          <div className="px-5 w-4/5 h-max justify-items-center">
            <Form {...formManager}>
              <form onSubmit={handleSubmit(onSubmit)}>
                <SimpleGrid cols={4}>
                  <ModifyDocumentFields document={document} formManager={formManager} />

                  <div className="space-y-2">
                    <Label htmlFor="file">File</Label>
                    <Link
                      to={document?.file?.toString() || ''}
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
                <div className="flex justify-center mt-5">
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
          </div>
          <div className=" w-1/5 h-max flex flex-col ">
            <div className="flex justify-center">
              {/* Mantine's `Image` added placeholder and object-fit handling this call site
                  never asked for; a plain img is the whole of what it rendered. The click
                  target is a real button now — it opens the scan in a drawer, and an img with
                  an onClick is neither focusable nor keyboard-operable. */}
              <button
                type="button"
                onClick={(): void => setOpenImage(!!document.image)}
                className="cursor-pointer"
              >
                <img
                  alt="Open document scan"
                  src={document?.image?.toString()}
                  className="bg-gray-300 p-5 mr-5 max-h-fit max-w-fit"
                />
              </button>
            </div>
          </div>
          <DocumentImageDrawer
            src={document.image}
            opened={openImage}
            onClose={(): void => setOpenImage(false)}
          />
        </>
      )}
    </div>
  );
};
