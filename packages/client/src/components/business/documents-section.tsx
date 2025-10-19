import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { RecentClientDocs } from '../common/documents/issue-document/recent-client-docs.js';

interface Props {
  businessId: string;
}

export function DocumentsSection({ businessId }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Invoices, proformas, receipts, and other accounting documents
            </CardDescription>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <RecentClientDocs clientId={businessId} linkedDocumentIds={[]} limit={1000} />
      </CardContent>
    </Card>
  );
}
