import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { RecentBusinessDocs } from '../common/documents/issue-document/recent-business-docs.js';

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
        </div>
      </CardHeader>
      <CardContent>
        <RecentBusinessDocs businessId={businessId} linkedDocumentIds={[]} limit={1000} />
      </CardContent>
    </Card>
  );
}
