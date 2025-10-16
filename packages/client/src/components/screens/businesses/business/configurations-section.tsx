import { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Separator } from '@/components/ui/separator.js';
import { Switch } from '@/components/ui/switch.js';

export function ConfigurationsSection() {
  const [phrases, setPhrases] = useState<string[]>(['Monthly payment', 'Invoice #']);
  const [emails, setEmails] = useState<string[]>(['billing@example.com', 'accounts@example.com']);
  const [internalLinks, setInternalLinks] = useState<string[]>([
    'https://drive.google.com/',
    'https://docs.google.com/',
  ]);
  const [newPhrase, setNewPhrase] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLink, setNewLink] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Recurring', 'Priority']);
  const [selectedAttachmentTypes, setSelectedAttachmentTypes] = useState<string[]>([
    'PDF',
    'Excel',
  ]);

  const availableTags = ['Recurring', 'Priority', 'Urgent', 'Review', 'Approved', 'Pending'];
  const availableAttachmentTypes = ['PDF', 'Excel', 'Word', 'Image', 'CSV'];

  const addPhrase = () => {
    if (newPhrase.trim()) {
      setPhrases([...phrases, newPhrase.trim()]);
      setNewPhrase('');
    }
  };

  const addEmail = () => {
    if (newEmail.trim()) {
      setEmails([...emails, newEmail.trim()]);
      setNewEmail('');
    }
  };

  const addLink = () => {
    if (newLink.trim()) {
      setInternalLinks([...internalLinks, newLink.trim()]);
      setNewLink('');
    }
  };

  const removePhrase = (index: number) => setPhrases(phrases.filter((_, i) => i !== index));
  const removeEmail = (index: number) => setEmails(emails.filter((_, i) => i !== index));
  const removeLink = (index: number) =>
    setInternalLinks(internalLinks.filter((_, i) => i !== index));

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const toggleAttachmentType = (type: string) => {
    setSelectedAttachmentTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurations</CardTitle>
        <CardDescription>
          Business status, tax settings, automation rules, and integration preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Business Status & Behavior</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-client">Is Client</Label>
                <p className="text-sm text-muted-foreground">Mark this business as a client</p>
              </div>
              <Switch id="is-client" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-active">Is Active</Label>
                <p className="text-sm text-muted-foreground">Business is currently active</p>
              </div>
              <Switch id="is-active" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-receipt-enough">Is Receipt Enough</Label>
                <p className="text-sm text-muted-foreground">
                  Generate ledger for receipt documents if no invoice available
                </p>
              </div>
              <Switch id="is-receipt-enough" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="no-docs-required">No Docs Required</Label>
                <p className="text-sm text-muted-foreground">
                  Skip document validation for common charges
                </p>
              </div>
              <Switch id="no-docs-required" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-vat-optional">Is VAT Optional</Label>
                <p className="text-sm text-muted-foreground">Mute missing VAT indicator</p>
              </div>
              <Switch id="is-vat-optional" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-exempt-dealer">Is Exempt Dealer</Label>
                <p className="text-sm text-muted-foreground">
                  Business is exempt from VAT requirements
                </p>
              </div>
              <Switch id="is-exempt-dealer" />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Default Settings</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sort-code">Sort Code</Label>
              <Select defaultValue="001">
                <SelectTrigger id="sort-code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="001">001 - General</SelectItem>
                  <SelectItem value="002">002 - Services</SelectItem>
                  <SelectItem value="003">003 - Products</SelectItem>
                  <SelectItem value="004">004 - Consulting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-category">Default Tax Category</Label>
              <Select defaultValue="standard">
                <SelectTrigger id="tax-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Rate (17%)</SelectItem>
                  <SelectItem value="reduced">Reduced Rate (9%)</SelectItem>
                  <SelectItem value="zero">Zero Rate (0%)</SelectItem>
                  <SelectItem value="exempt">Exempt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pcn874-type">Default PCN874 Record Type</Label>
              <Select defaultValue="type-a">
                <SelectTrigger id="pcn874-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="type-a">Type A - Standard</SelectItem>
                  <SelectItem value="type-b">Type B - Modified</SelectItem>
                  <SelectItem value="type-c">Type C - Special</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-description">Default Description</Label>
              <Input
                id="default-description"
                placeholder="Enter default description"
                defaultValue="Monthly service charge"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default Tags</Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Auto-matching Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure patterns for automatic matching of bank transactions and documents
          </p>

          <div className="space-y-3">
            <Label>Phrases</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add phrase..."
                value={newPhrase}
                onChange={e => setNewPhrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPhrase()}
              />
              <Button size="sm" onClick={addPhrase}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {phrases.map((phrase, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {phrase}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removePhrase(index)} />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Email Addresses</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Add email..."
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEmail()}
              />
              <Button size="sm" onClick={addEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {emails.map((email, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {email}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeEmail(index)} />
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Gmail Feature Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure Gmail integration settings for document processing
          </p>

          <div className="space-y-2">
            <Label>Attachment Types</Label>
            <div className="flex flex-wrap gap-2">
              {availableAttachmentTypes.map(type => (
                <Badge
                  key={type}
                  variant={selectedAttachmentTypes.includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleAttachmentType(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Internal Links</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="Add internal link..."
                value={newLink}
                onChange={e => setNewLink(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLink()}
              />
              <Button size="sm" onClick={addLink}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {internalLinks.map((link, index) => (
                <Badge key={index} variant="secondary" className="gap-1 max-w-xs truncate">
                  {link}
                  <X
                    className="h-3 w-3 cursor-pointer flex-shrink-0"
                    onClick={() => removeLink(index)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="use-message-body">Should Use Message Body</Label>
              <p className="text-sm text-muted-foreground">
                Extract information from email message body
              </p>
            </div>
            <Switch id="use-message-body" defaultChecked />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end border-t pt-6">
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
}
