'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { Plus } from 'lucide-react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import {
  AdminFinancialAccountsSectionDocument,
  type AdminFinancialAccountsSectionQuery,
} from '@/gql/graphql.js';
import { FinancialAccountCard } from '../financial-accounts/financial-account-card.js';
import {
  ModifyFinancialAccountModal,
  type ModifyFinancialAccountModalRef,
} from '../financial-accounts/modify-financial-account-dialog.js';
import type { FinancialAccount } from '../financial-accounts/types.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AdminFinancialAccountsSection($adminId: UUID!) {
    financialAccountsByOwner(ownerId: $adminId) {
      id
      __typename
      name
      number
      type
      privateOrBusiness
    }
  }
`;

function convertFinancialAccountDataToFormValues(
  account: AdminFinancialAccountsSectionQuery['financialAccountsByOwner'][number],
): FinancialAccount {
  return {
    id: account.id,
    accountNumber: account.number,
    isBusiness: account.privateOrBusiness === 'BUSINESS',
    type: account.type,
    currencies: [], // TODO: fetch currencies when supported
    // // Bank-specific fields
    // bankNumber?: number;
    // branchNumber?: number;
    // extendedBankNumber?: number;
    // partyPreferredIndication?: number;
    // partyAccountInvolvementCode?: number;
    // accountDealDate?: number;
    // accountUpdateDate?: number;
    // metegDoraNet?: number;
    // kodHarshaatPeilut?: number;
    // accountClosingReasonCode?: number;
    // accountAgreementOpeningDate?: number;
    // serviceAuthorizationDesc?: string;
    // branchTypeCode?: number;
    // mymailEntitlementSwitch?: number;
    // productLabel?: string;
  };
}

interface Props {
  adminId: string;
}

export function FinancialAccountsSection({ adminId }: Props): JSX.Element {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);

  const [{ data, fetching }, refetch] = useQuery({
    query: AdminFinancialAccountsSectionDocument,
    variables: {
      adminId,
    },
  });

  useEffect(() => {
    if (data?.financialAccountsByOwner) {
      setAccounts(
        data.financialAccountsByOwner?.map(convertFinancialAccountDataToFormValues) ?? [],
      );
    }
  }, [data]);

  const modalRef = useRef<ModifyFinancialAccountModalRef>(null);

  const handleOpenModal = (account?: FinancialAccount): void => {
    modalRef.current?.open(account);
  };

  const handleDeleteAccount = (id: string): void => {
    const confirmDelete = window.confirm('Delete this account? This action cannot be undone.');
    if (!confirmDelete) return;
    setAccounts(prev => prev.filter(acc => acc.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Financial Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Manage bank accounts, credit cards, and crypto wallets
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} aria-label="Create new financial account">
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          New Account
        </Button>
      </div>

      {fetching ? (
        <p>Loading...</p>
      ) : (
        <div className="grid gap-4">
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">No financial accounts added yet.</p>
          )}
          {accounts.map(account => (
            <FinancialAccountCard
              key={account.id}
              account={account}
              handleDeleteAccount={handleDeleteAccount}
              handleOpenModal={handleOpenModal}
            />
          ))}
        </div>
      )}

      <ModifyFinancialAccountModal ownerId={adminId} ref={modalRef} onDone={() => refetch()} />
    </div>
  );
}
