import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactElement,
} from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { useQuery } from 'urql';
import { getDocumentNameFromType } from '@/helpers/index.js';
import { getFragmentData } from '../../../gql/fragment-masking.js';
import {
  DocumentType,
  IssueDocumentClientFieldsFragmentDoc,
  NewDocumentDraftByChargeDocument,
  NewDocumentDraftByDocumentDocument,
  NewDocumentDraftFragmentDoc,
  type IssueDocumentClientFieldsFragment,
  type NewDocumentDraftFragment,
} from '../../../gql/graphql.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip.js';
import { GenerateDocument } from '../documents/issue-document/index.js';
import type {
  DocumentClient,
  PreviewDocumentInput,
} from '../forms/issue-document/types/document.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment IssueDocumentClientFields on Client {
    id
    originalBusiness {
      id
      address
      country {
        id
        code
      }
      governmentId
      name
      phoneNumber
    }
    emails
    # city
    # zip
    # fax
    # mobile
  }
`;

export function normalizeClientInfo(clientInfo: IssueDocumentClientFieldsFragment): DocumentClient {
  const client: DocumentClient = {
    // add: ___;
    address: clientInfo.originalBusiness.address ?? undefined,
    // city: ___,
    country: clientInfo.originalBusiness.country.code,
    emails: clientInfo.emails,
    // fax: ___,
    id: clientInfo.id,
    // mobile: ___,
    name: clientInfo.originalBusiness.name,
    phone: clientInfo.originalBusiness.phoneNumber ?? undefined,
    // self: ___,
    taxId: clientInfo.originalBusiness.governmentId ?? undefined,
    // zip: ___,
  };
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query NewDocumentDraftByCharge($chargeId: UUID!) {
    newDocumentDraftByCharge(chargeId: $chargeId) {
      ...NewDocumentDraft
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query NewDocumentDraftByDocument($documentId: UUID!) {
    newDocumentDraftByDocument(documentId: $documentId) {
      ...NewDocumentDraft
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment NewDocumentDraft on DocumentDraft {
    description
    remarks
    footer
    type
    date
    dueDate
    language
    currency
    vatType
    discount {
      amount
      type
    }
    rounding
    signed
    maxPayments
    client {
      id
      originalBusiness {
        id
        name
      }
      integrations {
        id
      }
      emails
      ...IssueDocumentClientFields
    }
    income {
      currency
      currencyRate
      description
      itemId
      price
      quantity
      vatRate
      vatType
    }
    payment {
      currency
      currencyRate
      date
      price
      type
      bankName
      bankBranch
      bankAccount
      chequeNum
      accountId
      transactionId
      cardType
      cardNum
      numPayments
      firstPayment
    }
    linkedDocumentIds
    linkedPaymentId
  }
`;

export function convertNewDocumentDraftFragmentIntoPreviewDocumentInput(
  documentDraft: NewDocumentDraftFragment,
  documentTypeOverride?: DocumentType,
): PreviewDocumentInput {
  let remarks: string | undefined = undefined;
  if (documentDraft.remarks) {
    remarks = documentDraft.remarks;
    if (documentTypeOverride === DocumentType.CreditInvoice) {
      remarks = remarks.replace(
        getDocumentNameFromType(DocumentType.Receipt),
        getDocumentNameFromType(DocumentType.CreditInvoice),
      );
    }
  }

  let { currency } = documentDraft;
  if (documentTypeOverride === DocumentType.CreditInvoice) {
    currency = documentDraft.income?.[0]?.currency || currency;
  }

  return {
    ...documentDraft,
    currency,
    description: documentDraft.description || undefined,
    remarks,
    footer: documentDraft.footer || undefined,
    date: documentDraft.date || undefined,
    dueDate: documentDraft.dueDate || undefined,
    discount: documentDraft.discount || undefined,
    rounding: documentDraft.rounding || undefined,
    signed: documentDraft.signed || undefined,
    maxPayments: documentDraft.maxPayments || undefined,
    client: documentDraft.client
      ? normalizeClientInfo(
          getFragmentData(IssueDocumentClientFieldsFragmentDoc, documentDraft.client),
        )
      : undefined,
    income: documentDraft.income?.map(income => ({
      ...income,
      currencyRate: income.currencyRate ?? undefined,
      itemId: income.itemId || undefined,
      vatRate: income.vatRate ?? undefined,
    })),
    payment: documentDraft.payment?.map(payment => ({
      ...payment,
      currencyRate: payment.currencyRate || undefined,
      date: payment.date || undefined,
      bankName: payment.bankName || undefined,
      bankBranch: payment.bankBranch || undefined,
      bankAccount: payment.bankAccount || undefined,
      chequeNum: payment.chequeNum || undefined,
      accountId: payment.accountId || undefined,
      transactionId: payment.transactionId || undefined,
      cardType: payment.cardType || undefined,
      cardNum: payment.cardNum || undefined,
      numPayments: payment.numPayments || undefined,
      firstPayment: payment.firstPayment || undefined,
    })),
    linkedDocumentIds: documentDraft.linkedDocumentIds || undefined,
    linkedPaymentId: documentDraft.linkedPaymentId || undefined,
    type: documentTypeOverride || documentDraft.type,
  };
}

type Props = {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  tooltip?: string;
  chargeId?: string;
  documentId?: string;
  documentType?: DocumentType;
  onDone?: (draft: PreviewDocumentInput) => void;
  trigger?: ReactElement;
} & ComponentProps<typeof GenerateDocument>;

export function PreviewDocumentModal({
  open: externalOpen = false,
  setOpen: setExternalOpen,
  tooltip,
  chargeId,
  documentId,
  documentType,
  onDone,
  trigger,
  ...props
}: Props): ReactElement {
  const [internalOpen, setInternalOpen] = useState(false);
  const [initialFormData, setInitialFormData] = useState<Partial<PreviewDocumentInput> | undefined>(
    'initialFormData' in props && props.initialFormData ? props.initialFormData : undefined,
  );

  // handle internal/external open state
  const open = useMemo(
    () => (setExternalOpen ? externalOpen : internalOpen),
    [externalOpen, internalOpen, setExternalOpen],
  );
  const setOpen = useCallback(
    (open: boolean) => {
      if (setExternalOpen) {
        setExternalOpen(open);
      } else {
        setInternalOpen(open);
      }
    },
    [setExternalOpen],
  );

  const [{ data: dataByCharge, fetching: fetchingByCharge, error: errorByCharge }, fetchByCharge] =
    useQuery({
      query: NewDocumentDraftByChargeDocument,
      pause: !chargeId || !open,
      variables: {
        chargeId: chargeId || '',
      },
    });

  const [
    { data: dataByDocument, fetching: fetchingByDocument, error: errorByDocument },
    fetchByDocument,
  ] = useQuery({
    query: NewDocumentDraftByDocumentDocument,
    pause: !documentId || !open,
    variables: {
      documentId: documentId || '',
    },
  });

  useEffect(() => {
    if (open) {
      if (chargeId && !dataByCharge && !fetchingByCharge && !errorByCharge) {
        fetchByCharge();
      } else if (documentId && !dataByDocument && !fetchingByDocument && !errorByDocument) {
        fetchByDocument();
      }
    }
  }, [
    chargeId,
    dataByCharge,
    fetchingByCharge,
    errorByCharge,
    fetchByCharge,
    documentId,
    dataByDocument,
    fetchingByDocument,
    errorByDocument,
    fetchByDocument,
    open,
  ]);

  useEffect(() => {
    let documentDraftDraft: NewDocumentDraftFragment | undefined = undefined;
    if (dataByCharge?.newDocumentDraftByCharge) {
      documentDraftDraft = getFragmentData(
        NewDocumentDraftFragmentDoc,
        dataByCharge.newDocumentDraftByCharge,
      );
    } else if (dataByDocument?.newDocumentDraftByDocument) {
      documentDraftDraft = getFragmentData(
        NewDocumentDraftFragmentDoc,
        dataByDocument.newDocumentDraftByDocument,
      );
    }
    if (documentDraftDraft) {
      const draft = convertNewDocumentDraftFragmentIntoPreviewDocumentInput(
        documentDraftDraft,
        documentType,
      );
      setInitialFormData(draft);
    }
  }, [dataByCharge, dataByDocument, documentType]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {(!setExternalOpen || !!trigger) && (
        <DialogTrigger>
          <Tooltip>
            <TooltipTrigger>
              {trigger ?? (
                <Button className="size-7.5" variant="ghost">
                  <Receipt className="size-5" />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip || 'Issue new document'}</p>
            </TooltipContent>
          </Tooltip>
        </DialogTrigger>
      )}
      <DialogContent className="w-[90vw] sm:max-w-[95%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue New Document</DialogTitle>
        </DialogHeader>
        {fetchingByCharge || fetchingByDocument ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <GenerateDocument
            initialFormData={initialFormData}
            onDone={
              onDone
                ? value => {
                    onDone(value);
                    setOpen(false);
                  }
                : undefined
            }
            chargeId={chargeId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
