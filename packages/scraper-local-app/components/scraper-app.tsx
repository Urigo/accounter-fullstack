'use client';

import { useState } from 'react';
import { Building2, CreditCard, FileCode, Play, Plus, Settings } from 'lucide-react';
import { AccountForm } from '@/components/account-form';
import { AccountsList } from '@/components/accounts-list';
import { ConfiguredSourceCard } from '@/components/configured-source-card';
import { ExecutionPanel } from '@/components/execution-panel';
import { ServerConfig } from '@/components/server-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { YamlPanel } from '@/components/yaml-panel';
import { AccountConfig, AVAILABLE_SOURCES, ScraperConfig, Source } from '@/lib/types';

type View = { type: 'sources' } | { type: 'accounts'; source: Source };

export function ScraperApp() {
  const [config, setConfig] = useState<ScraperConfig>({
    serverUrl: '',
    apiKey: '',
    databaseConnectionString: '',
    accounts: [],
  });

  const [view, setView] = useState<View>({ type: 'sources' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<{
    source: Source;
    account?: AccountConfig;
  } | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);

  const getAccountsForSource = (sourceId: string) => {
    return config.accounts.filter(a => a.sourceId === sourceId);
  };

  // Get sources that have at least one account configured
  const getConfiguredSources = () => {
    const configuredSourceIds = new Set(config.accounts.map(a => a.sourceId));
    return AVAILABLE_SOURCES.filter(s => configuredSourceIds.has(s.id));
  };

  const handleSelectSource = (source: Source) => {
    setSourcePickerOpen(false);
    setEditingAccount({ source });
    setDialogOpen(true);
  };

  const handleAddAccount = (source: Source) => {
    setEditingAccount({ source });
    setDialogOpen(true);
  };

  const handleEditAccount = (source: Source, account: AccountConfig) => {
    setEditingAccount({ source, account });
    setDialogOpen(true);
  };

  const handleSaveAccount = (account: AccountConfig) => {
    setConfig(prev => {
      const existingIndex = prev.accounts.findIndex(a => a.id === account.id);
      if (existingIndex >= 0) {
        const newAccounts = [...prev.accounts];
        newAccounts[existingIndex] = account;
        return { ...prev, accounts: newAccounts };
      } else {
        return { ...prev, accounts: [...prev.accounts, account] };
      }
    });
    setDialogOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (accountId: string) => {
    setConfig(prev => ({
      ...prev,
      accounts: prev.accounts.filter(a => a.id !== accountId),
    }));
  };

  const handleImportConfig = (importedConfig: ScraperConfig) => {
    setConfig(importedConfig);
    setView({ type: 'sources' });
  };

  const handleConfigure = (source: Source) => {
    setView({ type: 'accounts', source });
  };

  const totalAccounts = config.accounts.length;
  const configuredSources = getConfiguredSources();
  const bankSources = AVAILABLE_SOURCES.filter(s => s.type === 'bank');
  const creditCardSources = AVAILABLE_SOURCES.filter(s => s.type === 'creditcard');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Financial Scraper</h1>
              <p className="text-sm text-muted-foreground">
                {totalAccounts} {totalAccounts === 1 ? 'account' : 'accounts'} configured
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configure
            </TabsTrigger>
            <TabsTrigger value="execute" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Execute
            </TabsTrigger>
            <TabsTrigger value="yaml" className="flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              YAML
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            {view.type === 'sources' && (
              <>
                {/* Server Configuration */}
                <ServerConfig
                  serverUrl={config.serverUrl}
                  onServerUrlChange={url => setConfig(prev => ({ ...prev, serverUrl: url }))}
                />

                {/* Configured Sources */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Sources</h2>
                    <Button onClick={() => setSourcePickerOpen(true)} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Source
                    </Button>
                  </div>

                  {configuredSources.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-4">
                          <Plus className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium text-foreground mb-1">No sources configured</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add a bank or credit card source to get started
                        </p>
                        <Button onClick={() => setSourcePickerOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Source
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {configuredSources.map(source => (
                        <ConfiguredSourceCard
                          key={source.id}
                          source={source}
                          accounts={getAccountsForSource(source.id)}
                          onConfigure={() => handleConfigure(source)}
                          onAddAccount={() => handleAddAccount(source)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {view.type === 'accounts' && (
              <AccountsList
                source={view.source}
                accounts={getAccountsForSource(view.source.id)}
                onEdit={account => handleEditAccount(view.source, account)}
                onDelete={handleDeleteAccount}
                onAdd={() => handleAddAccount(view.source)}
                onBack={() => setView({ type: 'sources' })}
              />
            )}
          </TabsContent>

          <TabsContent value="execute">
            <ExecutionPanel config={config} />
          </TabsContent>

          <TabsContent value="yaml">
            <YamlPanel config={config} onImport={handleImportConfig} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Source Picker Dialog */}
      <Dialog open={sourcePickerOpen} onOpenChange={setSourcePickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Source</DialogTitle>
            <DialogDescription>Select a bank or credit card to configure</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Banks</h3>
              <div className="grid gap-2">
                {bankSources.map(source => (
                  <button
                    key={source.id}
                    onClick={() => handleSelectSource(source)}
                    className="flex items-center gap-3 w-full p-3 rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/50 transition-colors text-left"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{source.name}</div>
                      <div className="text-sm text-muted-foreground">Bank Account</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Credit Cards</h3>
              <div className="grid gap-2">
                {creditCardSources.map(source => (
                  <button
                    key={source.id}
                    onClick={() => handleSelectSource(source)}
                    className="flex items-center gap-3 w-full p-3 rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/50 transition-colors text-left"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{source.name}</div>
                      <div className="text-sm text-muted-foreground">Credit Card</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount?.account ? 'Edit Account' : 'Add Account'}</DialogTitle>
            <DialogDescription>
              {editingAccount &&
                `Configure your ${editingAccount.source.name} account credentials and filters`}
            </DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <AccountForm
              source={editingAccount.source}
              account={editingAccount.account}
              onSave={handleSaveAccount}
              onCancel={() => {
                setDialogOpen(false);
                setEditingAccount(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
