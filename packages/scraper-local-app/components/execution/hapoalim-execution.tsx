'use client';

import { useState } from 'react';
import { AlertCircle, Building2, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { HapoalimExecution } from '@/lib/execution-types';
import { cn } from '@/lib/utils';
import { BankAccountExecutionView } from './bank-account-execution';
import { StepStatusIcon } from './step-status';

interface HapoalimExecutionViewProps {
  execution: HapoalimExecution;
  onOtpSubmit: (otp: string) => void;
  onNewAccountsDecision: (skip: boolean) => void;
}

export function HapoalimExecutionView({
  execution,
  onOtpSubmit,
  onNewAccountsDecision,
}: HapoalimExecutionViewProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [otpInput, setOtpInput] = useState('');

  const getOverallStatus = () => {
    if (
      execution.login.status === 'error' ||
      execution.fetchAccounts.status === 'error' ||
      execution.validateAccounts.status === 'error'
    ) {
      return 'error';
    }

    if (execution.login.status === 'waiting-input') {
      return 'waiting-input';
    }

    if (execution.validateAccounts.status === 'waiting-input') {
      return 'waiting-input';
    }

    const allAccountsComplete = execution.bankAccounts.every(acc => {
      const flows = [acc.local, acc.foreign, acc.swift];
      return flows.every(f => f.insert.status === 'success' || f.insert.status === 'error');
    });

    if (allAccountsComplete && execution.bankAccounts.length > 0) {
      const hasAnyError = execution.bankAccounts.some(acc => {
        const flows = [acc.local, acc.foreign, acc.swift];
        return flows.some(f => f.insert.status === 'error');
      });
      return hasAnyError ? 'error' : 'success';
    }

    if (
      execution.login.status === 'running' ||
      execution.fetchAccounts.status === 'running' ||
      execution.validateAccounts.status === 'running' ||
      execution.bankAccounts.some(acc => {
        const flows = [acc.local, acc.foreign, acc.swift];
        return flows.some(
          f =>
            f.fetch.status === 'running' ||
            f.normalize.status === 'running' ||
            f.insert.status === 'running',
        );
      })
    ) {
      return 'running';
    }

    return 'idle';
  };

  const handleOtpSubmit = () => {
    if (otpInput.trim()) {
      onOtpSubmit(otpInput.trim());
      setOtpInput('');
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-3 w-full p-4 hover:bg-secondary/30 transition-colors">
          <ChevronRight className={cn('h-5 w-5 transition-transform', isOpen && 'rotate-90')} />
          <Building2 className="h-5 w-5 text-primary" />
          <div className="flex-1 text-left">
            <span className="font-medium">{execution.nickname || 'Hapoalim Account'}</span>
            {execution.isBusinessAccount && (
              <Badge variant="outline" className="ml-2 text-xs">
                Business
              </Badge>
            )}
          </div>
          <StepStatusIcon status={getOverallStatus()} className="h-5 w-5" />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            {/* Step 1: Login */}
            <ExecutionStep
              stepNumber={1}
              label="Login"
              result={execution.login}
              isBusinessAccount={execution.isBusinessAccount}
            >
              {execution.login.status === 'waiting-input' && execution.otpRequired && (
                <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-500 mb-2">OTP Required for Business Account</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter OTP code"
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value)}
                      className="max-w-[200px]"
                    />
                    <Button size="sm" onClick={handleOtpSubmit}>
                      Submit OTP
                    </Button>
                  </div>
                </div>
              )}
            </ExecutionStep>

            {/* Step 2: Fetch Bank Accounts */}
            <ExecutionStep
              stepNumber={2}
              label="Fetch Bank Accounts"
              result={execution.fetchAccounts}
            >
              {execution.discoveredAccounts && execution.discoveredAccounts.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Discovered accounts: {execution.discoveredAccounts.join(', ')}
                </div>
              )}
            </ExecutionStep>

            {/* Step 3: Validate Against Server */}
            <ExecutionStep
              stepNumber={3}
              label="Validate Accounts Against Server"
              result={execution.validateAccounts}
            >
              {execution.validateAccounts.status === 'waiting-input' &&
                execution.validationResult && (
                  <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-500 mb-2">New accounts detected on server</p>
                    <div className="text-xs text-muted-foreground mb-3">
                      <p>
                        Existing: {execution.validationResult.existingAccounts.join(', ') || 'None'}
                      </p>
                      <p>New: {execution.validationResult.newAccounts.join(', ')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onNewAccountsDecision(false)}>
                        Set Up New Accounts
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onNewAccountsDecision(true)}
                      >
                        Skip New Accounts
                      </Button>
                    </div>
                  </div>
                )}
            </ExecutionStep>

            {/* Step 4: Per-Account Execution */}
            {execution.bankAccounts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
                    4
                  </span>
                  <span>Process Bank Accounts</span>
                </div>
                <div className="ml-8 space-y-2">
                  {execution.bankAccounts.map(bankAccount => (
                    <BankAccountExecutionView
                      key={bankAccount.accountNumber}
                      execution={bankAccount}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error Summary */}
            {getOverallStatus() === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Some steps failed. Check the details above for more information.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface ExecutionStepProps {
  stepNumber: number;
  label: string;
  result: { status: string; message?: string; error?: string };
  isBusinessAccount?: boolean;
  children?: React.ReactNode;
}

function ExecutionStep({ stepNumber, label, result, children }: ExecutionStepProps) {
  const [isOpen, setIsOpen] = useState(
    result.status === 'error' || result.status === 'waiting-input',
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded hover:bg-secondary/50 transition-colors">
        <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
          {stepNumber}
        </span>
        <span className="text-sm font-medium flex-1 text-left">{label}</span>
        <StepStatusIcon status={result.status as any} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-12 py-2">
          {result.message && <p className="text-xs text-muted-foreground">{result.message}</p>}
          {result.error && <p className="text-xs text-destructive">{result.error}</p>}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
