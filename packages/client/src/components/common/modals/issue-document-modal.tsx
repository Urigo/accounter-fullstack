import { ComponentProps, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { NewDocumentDraftDocument } from '../../../gql/graphql.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { GenerateDocument } from '../documents/issue-document/index.js';
import { PreviewDocumentInput } from '../documents/issue-document/types/document.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query NewDocumentDraft($chargeId: UUID!) {
    newDocumentInfoDraft(chargeId: $chargeId) {
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
        amount
        amountTotal
        catalogNum
        currency
        currencyRate
        description
        itemId
        price
        quantity
        vat
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
  }
`;

type Props = {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  trigger?: ReactElement | null;
  chargeId?: string;
} & ComponentProps<typeof GenerateDocument>;

export function IssueDocumentModal({
  open: externalOpen = false,
  setOpen: setExternalOpen,
  trigger = null,
  chargeId,
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

  const [{ data, fetching, error }, fetchCharge] = useQuery({
    query: NewDocumentDraftDocument,
    pause: !chargeId,
    variables: {
      chargeId: chargeId || '',
    },
  });

  useEffect(() => {
    if (chargeId && !data && !fetching && !error) {
      fetchCharge();
    }
  }, [chargeId, data, fetching, error, fetchCharge]);

  useEffect(() => {
    if (data?.newDocumentInfoDraft) {
      const draft: PreviewDocumentInput = {
        ...data.newDocumentInfoDraft,
        description: data.newDocumentInfoDraft.description || undefined,
        remarks: data.newDocumentInfoDraft.remarks || undefined,
        footer: data.newDocumentInfoDraft.footer || undefined,
        date: data.newDocumentInfoDraft.date || undefined,
        dueDate: data.newDocumentInfoDraft.dueDate || undefined,
        discount: data.newDocumentInfoDraft.discount || undefined,
        rounding: data.newDocumentInfoDraft.rounding || undefined,
        signed: data.newDocumentInfoDraft.signed || undefined,
        maxPayments: data.newDocumentInfoDraft.maxPayments || undefined,
        client: data.newDocumentInfoDraft.client || undefined,
        income: data.newDocumentInfoDraft.income?.map(income => ({
          ...income,
          amount: income.amount || undefined,
          amountTotal: income.amountTotal || undefined,
          catalogNum: income.catalogNum || undefined,
          currencyRate: income.currencyRate || undefined,
          itemId: income.itemId || undefined,
          vat: income.vat || undefined,
          vatRate: income.vatRate || undefined,
        })),
        payment: data.newDocumentInfoDraft.payment?.map(payment => ({
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
        linkedDocumentIds: data.newDocumentInfoDraft.linkedDocumentIds || undefined,
        linkedPaymentId: data.newDocumentInfoDraft.linkedPaymentId || undefined,
      };
      setInitialFormData(draft);
    }
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[90vw] sm:max-w-[95%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue New Document</DialogTitle>
        </DialogHeader>
        {fetching ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <GenerateDocument initialFormData={initialFormData} />
        )}
      </DialogContent>
    </Dialog>
  );
}
