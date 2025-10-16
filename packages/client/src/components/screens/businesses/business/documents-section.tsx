import { Download, Eye, FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';

const documents = {
  invoices: [
    {
      id: 'INV-2024-001',
      date: '2024-10-15',
      amount: 1250.0,
      status: 'paid',
      client: 'Tech Solutions Inc.',
    },
    {
      id: 'INV-2024-002',
      date: '2024-10-10',
      amount: 890.0,
      status: 'pending',
      client: 'Digital Agency Co.',
    },
    {
      id: 'INV-2024-003',
      date: '2024-10-05',
      amount: 2100.0,
      status: 'overdue',
      client: 'Startup Ventures',
    },
  ],
  proformas: [
    {
      id: 'PRO-2024-001',
      date: '2024-10-12',
      amount: 3500.0,
      status: 'sent',
      client: 'Enterprise Corp.',
    },
    {
      id: 'PRO-2024-002',
      date: '2024-10-08',
      amount: 1800.0,
      status: 'draft',
      client: 'Local Business LLC',
    },
  ],
  receipts: [
    {
      id: 'REC-2024-001',
      date: '2024-10-14',
      amount: 450.0,
      category: 'Office Supplies',
      vendor: 'Office Depot',
    },
    {
      id: 'REC-2024-002',
      date: '2024-10-11',
      amount: 125.0,
      category: 'Software',
      vendor: 'Adobe',
    },
  ],
};

export function DocumentsSection() {
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
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="proformas">Proformas</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            {documents.invoices.map(doc => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{doc.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.client} • {doc.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">${doc.amount.toFixed(2)}</p>
                    <Badge
                      variant={
                        doc.status === 'paid'
                          ? 'default'
                          : doc.status === 'overdue'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {doc.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="proformas" className="space-y-4">
            {documents.proformas.map(doc => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{doc.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.client} • {doc.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">${doc.amount.toFixed(2)}</p>
                    <Badge variant="secondary">{doc.status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            {documents.receipts.map(doc => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{doc.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.vendor} • {doc.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">${doc.amount.toFixed(2)}</p>
                    <Badge variant="outline">{doc.category}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
