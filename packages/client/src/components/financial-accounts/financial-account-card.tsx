'use client';

import { type JSX } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import type { FinancialAccount } from './types.js';
import { getAccountIcon, getAccountTypeLabel } from './utils.js';

interface Props {
  account: FinancialAccount;
  handleDeleteAccount: (id: string) => void;
  handleOpenModal: (account?: FinancialAccount) => void;
}

export function FinancialAccountCard({
  account,
  handleDeleteAccount,
  handleOpenModal,
}: Props): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {getAccountIcon(account.type)}
            </div>
            <div>
              <CardTitle className="text-lg">
                {account.name}
                {account.name === account.number ? '' : ` (${account.number})`}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{getAccountTypeLabel(account.type)}</Badge>
                {!account.isBusiness && <Badge variant="secondary">Private</Badge>}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenModal(account)}
              aria-label={`Edit account ${account.name}`}
            >
              <Edit className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteAccount(account.id)}
              aria-label={`Delete account ${account.name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Currencies */}
        <div>
          <h4 className="text-sm font-medium mb-2">Currencies & Tax Categories</h4>
          <div className="flex flex-wrap gap-2">
            {account.currencies.map((curr, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {curr.currency} → {curr.taxCategory}
              </Badge>
            ))}
          </div>
        </div>

        {/* Bank-specific fields */}
        {account.type === 'BANK_ACCOUNT' && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Bank Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Bank Number:</span>
                <p className="font-medium">{account.bankNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Branch Number:</span>
                <p className="font-medium">{account.branchNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Extended Bank Number:</span>
                <p className="font-medium">{account.extendedBankNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Party Preferred Indication:</span>
                <p className="font-medium">{account.partyPreferredIndication}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Party Account Involvement:</span>
                <p className="font-medium">{account.partyAccountInvolvementCode}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account Deal Date:</span>
                <p className="font-medium">{account.accountDealDate}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account Update Date:</span>
                <p className="font-medium">{account.accountUpdateDate}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Meteg Dora Net:</span>
                <p className="font-medium">{account.metegDoraNet}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Kod Harshaot Peilut:</span>
                <p className="font-medium">{account.kodHarshaatPeilut}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Closing Reason Code:</span>
                <p className="font-medium">{account.accountClosingReasonCode}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Agreement Opening Date:</span>
                <p className="font-medium">{account.accountAgreementOpeningDate}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Branch Type Code:</span>
                <p className="font-medium">{account.branchTypeCode}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mymail Entitlement:</span>
                <p className="font-medium">{account.mymailEntitlementSwitch}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Service Authorization:</span>
                <p className="font-medium">{account.serviceAuthorizationDesc}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Product Label:</span>
                <p className="font-medium">{account.productLabel}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
