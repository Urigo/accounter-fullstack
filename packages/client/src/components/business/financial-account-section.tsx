'use client';

import type React from 'react';
import { useState } from 'react';
import { Bitcoin, Building2, CreditCard, Edit, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Switch } from '@/components/ui/switch.js';
import type { Currency } from '@/gql/graphql';

type AccountType = 'BANK' | 'CREDIT_CARD' | 'CRYPTO_WALLET';

interface CurrencyTaxCategory {
  currency: Currency;
  taxCategory: string;
}

interface FinancialAccount {
  id: string;
  accountNumber: string;
  isBusiness: boolean;
  type: AccountType;
  currencies: CurrencyTaxCategory[];
  // Bank-specific fields
  bankNumber?: number;
  branchNumber?: number;
  extendedBankNumber?: number;
  partyPreferredIndication?: number;
  partyAccountInvolvementCode?: number;
  accountDealDate?: number;
  accountUpdateDate?: number;
  metegDoraNet?: number;
  kodHarshaatPeilut?: number;
  accountClosingReasonCode?: number;
  accountAgreementOpeningDate?: number;
  serviceAuthorizationDesc?: string;
  branchTypeCode?: number;
  mymailEntitlementSwitch?: number;
  productLabel?: string;
}

export function FinancialAccountsSection() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([
    {
      id: '1',
      accountNumber: '123456789',
      isBusiness: true,
      type: 'BANK',
      currencies: [
        { currency: 'ILS', taxCategory: 'Standard ILS' },
        { currency: 'USD', taxCategory: 'Foreign Currency' },
      ],
      bankNumber: 12,
      branchNumber: 345,
      extendedBankNumber: 123_456_789,
      partyPreferredIndication: 1,
      partyAccountInvolvementCode: 2,
      accountDealDate: 20_200_101,
      accountUpdateDate: 20_240_101,
      metegDoraNet: 1,
      kodHarshaatPeilut: 100,
      accountClosingReasonCode: 0,
      accountAgreementOpeningDate: 20_200_101,
      serviceAuthorizationDesc: 'Full access',
      branchTypeCode: 1,
      mymailEntitlementSwitch: 1,
      productLabel: 'Business Checking Account',
    },
    {
      id: '2',
      accountNumber: '9876543210',
      isBusiness: false,
      type: 'CREDIT_CARD',
      currencies: [
        { currency: 'ILS', taxCategory: 'A-ILS category' },
        { currency: 'USD', taxCategory: 'SOME CATEGORY' },
      ],
    },
    {
      id: '3',
      accountNumber: '0xABC123DEF456',
      isBusiness: false,
      type: 'CRYPTO_WALLET',
      currencies: [{ currency: 'ETH', taxCategory: 'Crypto Assets' }],
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [formData, setFormData] = useState<Partial<FinancialAccount>>({
    accountNumber: '',
    isBusiness: false,
    type: 'BANK',
    currencies: [],
  });

  const handleOpenModal = (account?: FinancialAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData(account);
    } else {
      setEditingAccount(null);
      setFormData({
        accountNumber: '',
        isBusiness: false,
        type: 'BANK',
        currencies: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setFormData({
      accountNumber: '',
      isBusiness: false,
      type: 'BANK',
      currencies: [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAccount) {
      setAccounts(
        accounts.map(acc =>
          acc.id === editingAccount.id ? ({ ...formData, id: acc.id } as FinancialAccount) : acc,
        ),
      );
    } else {
      setAccounts([...accounts, { ...formData, id: Date.now().toString() } as FinancialAccount]);
    }
    handleCloseModal();
  };

  const addCurrency = () => {
    setFormData({
      ...formData,
      currencies: [...(formData.currencies || []), { currency: 'USD', taxCategory: '' }],
    });
  };

  const removeCurrency = (index: number) => {
    setFormData({
      ...formData,
      currencies: formData.currencies?.filter((_, i) => i !== index) || [],
    });
  };

  const updateCurrency = (index: number, field: keyof CurrencyTaxCategory, value: string) => {
    const updatedCurrencies = [...(formData.currencies || [])];
    updatedCurrencies[index] = { ...updatedCurrencies[index], [field]: value };
    setFormData({ ...formData, currencies: updatedCurrencies });
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'BANK':
        return <Building2 className="h-5 w-5" />;
      case 'CREDIT_CARD':
        return <CreditCard className="h-5 w-5" />;
      case 'CRYPTO_WALLET':
        return <Bitcoin className="h-5 w-5" />;
    }
  };

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'BANK':
        return 'Bank Account';
      case 'CREDIT_CARD':
        return 'Credit Card';
      case 'CRYPTO_WALLET':
        return 'Crypto Wallet';
    }
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
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Account
        </Button>
      </div>

      <div className="grid gap-4">
        {accounts.map(account => (
          <Card key={account.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{account.accountNumber}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{getAccountTypeLabel(account.type)}</Badge>
                      {account.isBusiness && <Badge variant="secondary">Business</Badge>}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleOpenModal(account)}>
                  <Edit className="h-4 w-4" />
                </Button>
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
              {account.type === 'BANK' && (
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
        ))}
      </div>

      {/* Add/Edit Account Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Update account details and settings'
                : 'Add a new financial account'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Account Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: AccountType) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK">Bank Account</SelectItem>
                      <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                      <SelectItem value="CRYPTO_WALLET">Crypto Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isBusiness"
                    checked={formData.isBusiness}
                    onCheckedChange={checked => setFormData({ ...formData, isBusiness: checked })}
                  />
                  <Label htmlFor="isBusiness">Business Account</Label>
                </div>
              </div>
            </div>

            {/* Currencies & Tax Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Currencies & Tax Categories</h3>
                <Button type="button" variant="outline" size="sm" onClick={addCurrency}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Currency
                </Button>
              </div>
              <div className="space-y-3">
                {formData.currencies?.map((curr, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Currency (e.g., ILS, USD)"
                        value={curr.currency}
                        onChange={e => updateCurrency(index, 'currency', e.target.value)}
                      />
                      <Input
                        placeholder="Tax Category"
                        value={curr.taxCategory}
                        onChange={e => updateCurrency(index, 'taxCategory', e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCurrency(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bank-specific fields */}
            {formData.type === 'BANK' && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Bank-Specific Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankNumber">Bank Number</Label>
                    <Input
                      id="bankNumber"
                      type="number"
                      value={formData.bankNumber || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          bankNumber: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branchNumber">Branch Number</Label>
                    <Input
                      id="branchNumber"
                      type="number"
                      value={formData.branchNumber || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          branchNumber: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="extendedBankNumber">Extended Bank Number</Label>
                    <Input
                      id="extendedBankNumber"
                      type="number"
                      value={formData.extendedBankNumber || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          extendedBankNumber: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="partyPreferredIndication">Party Preferred Indication</Label>
                    <Input
                      id="partyPreferredIndication"
                      type="number"
                      value={formData.partyPreferredIndication || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          partyPreferredIndication: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="partyAccountInvolvementCode">
                      Party Account Involvement Code
                    </Label>
                    <Input
                      id="partyAccountInvolvementCode"
                      type="number"
                      value={formData.partyAccountInvolvementCode || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          partyAccountInvolvementCode: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountDealDate">Account Deal Date</Label>
                    <Input
                      id="accountDealDate"
                      type="number"
                      placeholder="YYYYMMDD"
                      value={formData.accountDealDate || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          accountDealDate: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountUpdateDate">Account Update Date</Label>
                    <Input
                      id="accountUpdateDate"
                      type="number"
                      placeholder="YYYYMMDD"
                      value={formData.accountUpdateDate || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          accountUpdateDate: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metegDoraNet">Meteg Dora Net</Label>
                    <Input
                      id="metegDoraNet"
                      type="number"
                      value={formData.metegDoraNet || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          metegDoraNet: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kodHarshaatPeilut">Kod Harshaot Peilut</Label>
                    <Input
                      id="kodHarshaatPeilut"
                      type="number"
                      value={formData.kodHarshaatPeilut || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          kodHarshaatPeilut: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountClosingReasonCode">Account Closing Reason Code</Label>
                    <Input
                      id="accountClosingReasonCode"
                      type="number"
                      value={formData.accountClosingReasonCode || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          accountClosingReasonCode: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountAgreementOpeningDate">
                      Account Agreement Opening Date
                    </Label>
                    <Input
                      id="accountAgreementOpeningDate"
                      type="number"
                      placeholder="YYYYMMDD"
                      value={formData.accountAgreementOpeningDate || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          accountAgreementOpeningDate: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branchTypeCode">Branch Type Code</Label>
                    <Input
                      id="branchTypeCode"
                      type="number"
                      value={formData.branchTypeCode || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          branchTypeCode: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mymailEntitlementSwitch">Mymail Entitlement Switch</Label>
                    <Input
                      id="mymailEntitlementSwitch"
                      type="number"
                      value={formData.mymailEntitlementSwitch || ''}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          mymailEntitlementSwitch: Number.parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="serviceAuthorizationDesc">
                      Service Authorization Description
                    </Label>
                    <Input
                      id="serviceAuthorizationDesc"
                      value={formData.serviceAuthorizationDesc || ''}
                      onChange={e =>
                        setFormData({ ...formData, serviceAuthorizationDesc: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <Label htmlFor="productLabel">Product Label</Label>
                    <Input
                      id="productLabel"
                      value={formData.productLabel || ''}
                      onChange={e => setFormData({ ...formData, productLabel: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button type="submit">{editingAccount ? 'Update Account' : 'Create Account'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
