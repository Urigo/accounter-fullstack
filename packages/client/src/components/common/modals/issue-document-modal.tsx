import { ComponentProps, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { useQuery } from 'urql';
import { getFragmentData } from '../../../gql/fragment-masking.js';
import {
  NewDocumentDraftByChargeDocument,
  NewDocumentDraftByDocumentDocument,
  NewDocumentInfoFragment,
  NewDocumentInfoFragmentDoc,
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
import { PreviewDocumentInput } from '../documents/issue-document/types/document.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query NewDocumentDraftByCharge($chargeId: UUID!) {
    newDocumentInfoDraftByCharge(chargeId: $chargeId) {
      ...NewDocumentInfo
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query NewDocumentDraftByDocument($documentId: UUID!) {
    newDocumentInfoDraftByDocument(documentId: $documentId) {
      ...NewDocumentInfo
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment NewDocumentInfo on NewDocumentInfo {
    description
    remarks
    footer
    type
    date
    dueDate
    lang
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
      subType
      bankName
      bankBranch
      bankAccount
      chequeNum
      accountId
      transactionId
      appType
      cardType
      cardNum
      dealType
      numPayments
      firstPayment
    }
    linkedDocumentIds
    linkedPaymentId
  }
`;

type Props = {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  tooltip?: string;
  chargeId?: string;
  documentId?: string;
} & ComponentProps<typeof GenerateDocument>;

export function IssueDocumentModal({
  open: externalOpen = false,
  setOpen: setExternalOpen,
  tooltip,
  chargeId,
  documentId,
  ...props
}: Props): ReactElement {
  const [internalOpen, setInternalOpen] = useState(false);
  const [initialFormData, setInitialFormData] = useState<Partial<PreviewDocumentInput>>(
    'initialFormData' in props && props.initialFormData ? props.initialFormData : {},
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
      pause: !chargeId,
      variables: {
        chargeId: chargeId || '',
      },
    });

  const [
    { data: dataByDocument, fetching: fetchingByDocument, error: errorByDocument },
    fetchByDocument,
  ] = useQuery({
    query: NewDocumentDraftByDocumentDocument,
    pause: !documentId,
    variables: {
      documentId: documentId || '',
    },
  });

  useEffect(() => {
    if (chargeId && !dataByCharge && !fetchingByCharge && !errorByCharge) {
      fetchByCharge();
    } else if (documentId && !dataByDocument && !fetchingByDocument && !errorByDocument) {
      fetchByDocument();
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
  ]);

  useEffect(() => {
    let newDocumentInfoDraft: NewDocumentInfoFragment | undefined = undefined;
    if (dataByCharge?.newDocumentInfoDraftByCharge) {
      newDocumentInfoDraft = getFragmentData(
        NewDocumentInfoFragmentDoc,
        dataByCharge.newDocumentInfoDraftByCharge,
      );
    } else if (dataByDocument?.newDocumentInfoDraftByDocument) {
      newDocumentInfoDraft = getFragmentData(
        NewDocumentInfoFragmentDoc,
        dataByDocument.newDocumentInfoDraftByDocument,
      );
    }
    if (newDocumentInfoDraft) {
      const draft: PreviewDocumentInput = {
        ...newDocumentInfoDraft,
        description: newDocumentInfoDraft.description || undefined,
        remarks: newDocumentInfoDraft.remarks || undefined,
        footer: newDocumentInfoDraft.footer || undefined,
        date: newDocumentInfoDraft.date || undefined,
        dueDate: newDocumentInfoDraft.dueDate || undefined,
        discount: newDocumentInfoDraft.discount || undefined,
        rounding: newDocumentInfoDraft.rounding || undefined,
        signed: newDocumentInfoDraft.signed || undefined,
        maxPayments: newDocumentInfoDraft.maxPayments || undefined,
        client: newDocumentInfoDraft.client || undefined,
        income: newDocumentInfoDraft.income?.map(income => ({
          ...income,
          currencyRate: income.currencyRate ?? undefined,
          itemId: income.itemId || undefined,
          vatRate: income.vatRate ?? undefined,
        })),
        payment: newDocumentInfoDraft.payment?.map(payment => ({
          ...payment,
          currencyRate: payment.currencyRate || undefined,
          date: payment.date || undefined,
          subType: payment.subType || undefined,
          bankName: payment.bankName || undefined,
          bankBranch: payment.bankBranch || undefined,
          bankAccount: payment.bankAccount || undefined,
          chequeNum: payment.chequeNum || undefined,
          accountId: payment.accountId || undefined,
          transactionId: payment.transactionId || undefined,
          appType: payment.appType || undefined,
          cardType: payment.cardType || undefined,
          cardNum: payment.cardNum || undefined,
          dealType: payment.dealType || undefined,
          numPayments: payment.numPayments || undefined,
          firstPayment: payment.firstPayment || undefined,
        })),
        linkedDocumentIds: newDocumentInfoDraft.linkedDocumentIds || undefined,
        linkedPaymentId: newDocumentInfoDraft.linkedPaymentId || undefined,
      };
      setInitialFormData(draft);
    }
  }, [dataByCharge, dataByDocument]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Tooltip>
          <TooltipTrigger>
            <Button className="size-7.5" variant="ghost">
              <Receipt className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip || 'Issue new document'}</p>
          </TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="w-[90vw] sm:max-w-[95%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue New Document</DialogTitle>
        </DialogHeader>
        {fetchingByCharge || fetchingByDocument ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <GenerateDocument initialFormData={initialFormData} />
        )}
      </DialogContent>
    </Dialog>
  );
}
