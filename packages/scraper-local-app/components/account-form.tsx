'use client';

import { useState } from 'react';
import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AccountConfig,
  AmexAccountConfig,
  BaseCreditCardConfig,
  CalAccountConfig,
  createEmptyAccount,
  DiscountAccountConfig,
  HapoalimAccountConfig,
  IsracardAccountConfig,
  MaxAccountConfig,
  Source,
} from '@/lib/types';

interface AccountFormProps {
  source: Source;
  account?: AccountConfig;
  onSave: (account: AccountConfig) => void;
  onCancel: () => void;
}

function TagInput({
  label,
  description,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  description?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const addValue = () => {
    if (inputValue.trim() && !values.includes(inputValue.trim())) {
      onChange([...values, inputValue.trim()]);
      setInputValue('');
    }
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={addValue}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map((value, index) => (
            <Badge key={index} variant="secondary" className="pr-1">
              {value}
              <button
                type="button"
                onClick={() => removeValue(index)}
                className="ml-2 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountForm({ source, account, onSave, onCancel }: AccountFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<AccountConfig>(() => {
    if (account) return account;
    return createEmptyAccount(source.id);
  });

  const isBankForm = source.type === 'bank';

  const updateField = <K extends keyof AccountConfig>(field: K, value: AccountConfig[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Account Nickname</Label>
            <Input
              id="nickname"
              value={formData.nickname}
              onChange={e => updateField('nickname', e.target.value)}
              placeholder="e.g., Personal Account, Business Account"
            />
          </div>
        </div>

        {/* Source-specific Credentials */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-medium text-muted-foreground">Credentials</h3>

          {/* Hapoalim: userCode + password */}
          {source.id === 'hapoalim' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="userCode">User Code</Label>
                <Input
                  id="userCode"
                  value={(formData as HapoalimAccountConfig).userCode}
                  onChange={e => setFormData(prev => ({ ...prev, userCode: e.target.value }))}
                  placeholder="Enter your user code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => updateField('password', e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Discount: ID + password + code */}
          {source.id === 'discount' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number</Label>
                <Input
                  id="idNumber"
                  value={(formData as DiscountAccountConfig).idNumber}
                  onChange={e => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
                  placeholder="Enter your ID number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => updateField('password', e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={(formData as DiscountAccountConfig).code}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="Enter your code"
                />
              </div>
            </>
          )}

          {/* Isracard & Amex: ID + password + last6Digits */}
          {(source.id === 'isracard' || source.id === 'amex') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number</Label>
                <Input
                  id="idNumber"
                  value={(formData as IsracardAccountConfig | AmexAccountConfig).idNumber}
                  onChange={e => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
                  placeholder="Enter your ID number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => updateField('password', e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last6Digits">Last 6 Digits</Label>
                <Input
                  id="last6Digits"
                  value={(formData as IsracardAccountConfig | AmexAccountConfig).last6Digits}
                  onChange={e => setFormData(prev => ({ ...prev, last6Digits: e.target.value }))}
                  placeholder="Enter last 6 digits of card"
                  maxLength={6}
                />
              </div>
            </>
          )}

          {/* CAL: username + password + 4digits */}
          {source.id === 'cal' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={(formData as CalAccountConfig).username}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => updateField('password', e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fourDigits">4 Digits</Label>
                <Input
                  id="fourDigits"
                  value={(formData as CalAccountConfig).fourDigits}
                  onChange={e => setFormData(prev => ({ ...prev, fourDigits: e.target.value }))}
                  placeholder="Enter 4 digits"
                  maxLength={4}
                />
              </div>
            </>
          )}

          {/* MAX: username + password */}
          {source.id === 'max' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={(formData as MaxAccountConfig).username}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => updateField('password', e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bank-specific fields */}
        {isBankForm && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Business Account</Label>
                <p className="text-sm text-muted-foreground">
                  Enable if this is a business/corporate account
                </p>
              </div>
              <Switch
                checked={
                  (formData as HapoalimAccountConfig | DiscountAccountConfig).isBusinessAccount
                }
                onCheckedChange={checked =>
                  setFormData(prev => ({
                    ...prev,
                    isBusinessAccount: checked,
                  }))
                }
              />
            </div>

            <TagInput
              label="Account Numbers to Include"
              description="Leave empty to include all accounts"
              values={(formData as HapoalimAccountConfig | DiscountAccountConfig).accountsToInclude}
              onChange={values =>
                setFormData(prev => ({
                  ...prev,
                  accountsToInclude: values,
                }))
              }
              placeholder="Enter account number"
            />

            <TagInput
              label="Account Numbers to Exclude"
              values={(formData as HapoalimAccountConfig | DiscountAccountConfig).accountsToExclude}
              onChange={values =>
                setFormData(prev => ({
                  ...prev,
                  accountsToExclude: values,
                }))
              }
              placeholder="Enter account number"
            />

            <TagInput
              label="Branch Numbers to Include"
              description="Leave empty to include all branches"
              values={
                (formData as HapoalimAccountConfig | DiscountAccountConfig).branchNumbersToInclude
              }
              onChange={values =>
                setFormData(prev => ({
                  ...prev,
                  branchNumbersToInclude: values,
                }))
              }
              placeholder="Enter branch number"
            />

            <TagInput
              label="Branch Numbers to Exclude"
              values={
                (formData as HapoalimAccountConfig | DiscountAccountConfig).branchNumbersToExclude
              }
              onChange={values =>
                setFormData(prev => ({
                  ...prev,
                  branchNumbersToExclude: values,
                }))
              }
              placeholder="Enter branch number"
            />
          </div>
        )}

        {/* Credit Card specific fields */}
        {!isBankForm && (
          <div className="space-y-4 border-t pt-4">
            {/* Isracard-specific: months to scrape */}
            {source.id === 'isracard' && (
              <div className="space-y-2">
                <Label htmlFor="monthsToScrape">Months to Scrape</Label>
                <p className="text-sm text-muted-foreground">
                  Number of months back from today to fetch transactions
                </p>
                <Input
                  id="monthsToScrape"
                  type="number"
                  min={1}
                  max={24}
                  value={(formData as IsracardAccountConfig).monthsToScrape || 3}
                  onChange={e =>
                    setFormData(prev => ({
                      ...(prev as IsracardAccountConfig),
                      monthsToScrape: parseInt(e.target.value) || 3,
                    }))
                  }
                  className="w-24"
                />
              </div>
            )}

            <TagInput
              label="Card Numbers to Include"
              description="Enter last 4 digits. Leave empty to include all cards"
              values={(formData as BaseCreditCardConfig).cardNumbersToInclude}
              onChange={values =>
                setFormData(prev => ({
                  ...prev,
                  cardNumbersToInclude: values,
                }))
              }
              placeholder="Enter last 4 digits"
            />

            <TagInput
              label="Card Numbers to Exclude"
              description="Enter last 4 digits of cards to exclude"
              values={(formData as BaseCreditCardConfig).cardNumbersToExclude}
              onChange={values =>
                setFormData(prev => ({
                  ...prev,
                  cardNumbersToExclude: values,
                }))
              }
              placeholder="Enter last 4 digits"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{account ? 'Save Changes' : 'Add Account'}</Button>
        </div>
      </div>
    </form>
  );
}
