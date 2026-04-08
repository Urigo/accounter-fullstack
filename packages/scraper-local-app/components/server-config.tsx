'use client';

import { useState } from 'react';
import { Database, Eye, EyeOff, Key, Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ServerConfigProps {
  serverUrl: string;
  apiKey: string;
  databaseConnectionString: string;
  onServerUrlChange: (url: string) => void;
  onApiKeyChange: (key: string) => void;
  onDatabaseConnectionStringChange: (connectionString: string) => void;
}

export function ServerConfig({
  serverUrl,
  apiKey,
  databaseConnectionString,
  onServerUrlChange,
  onApiKeyChange,
  onDatabaseConnectionStringChange,
}: ServerConfigProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDbString, setShowDbString] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Server & Database Configuration</CardTitle>
            <CardDescription>Configure where scraped data will be sent and stored</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Server URL */}
        <div className="space-y-2">
          <Label htmlFor="serverUrl" className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            Server URL
          </Label>
          <Input
            id="serverUrl"
            type="url"
            value={serverUrl}
            onChange={e => onServerUrlChange(e.target.value)}
            placeholder="https://your-server.com/api/transactions"
          />
          <p className="text-sm text-muted-foreground">
            The endpoint that will receive the scraped transaction data
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey" className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            API Key
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => onApiKeyChange(e.target.value)}
              placeholder="Enter your API key"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Authentication key for the server API</p>
        </div>

        {/* Database Connection String */}
        <div className="space-y-2">
          <Label htmlFor="databaseConnectionString" className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Database Connection String
            <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative">
            <Input
              id="databaseConnectionString"
              type={showDbString ? 'text' : 'password'}
              value={databaseConnectionString}
              onChange={e => onDatabaseConnectionStringChange(e.target.value)}
              placeholder="postgresql://user:pass@host:5432/db"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowDbString(!showDbString)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showDbString ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            If provided, pre-normalized (origin) data will be saved to this database before
            normalization
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
