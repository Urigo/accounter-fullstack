'use client';

import { Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ServerConfigProps {
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
}

export function ServerConfig({ serverUrl, onServerUrlChange }: ServerConfigProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Server Configuration</CardTitle>
            <CardDescription>Where the scraped data will be sent</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="serverUrl">Server URL</Label>
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
      </CardContent>
    </Card>
  );
}
