'use client';

import { User } from 'lucide-react';
import {
  GreenInvoiceCountry,
  type IssueDocumentClientFieldsFragment,
} from '../../../../gql/graphql.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.js';
import { Input } from '../../../ui/input.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import type { GreenInvoiceClient } from './types/document.js';
import { getCountryOptions } from './utils/enum-helpers.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment IssueDocumentClientFields on GreenInvoiceClient {
    greenInvoiceId
    businessId
    country
    emails
    name
    phone
    taxId
    address
    city
    zip
    fax
    mobile
  }
`;

export function normalizeClientInfo(
  clientInfo: IssueDocumentClientFieldsFragment,
): GreenInvoiceClient {
  const client: GreenInvoiceClient = {
    ...clientInfo,
    greenInvoiceId: clientInfo.greenInvoiceId || undefined,
    country: clientInfo.country || undefined,
    emails: clientInfo.emails || undefined,
    name: clientInfo.name || undefined,
    phone: clientInfo.phone || undefined,
    taxId: clientInfo.taxId || undefined,
    address: clientInfo.address || undefined,
    city: clientInfo.city || undefined,
    zip: clientInfo.zip || undefined,
    fax: clientInfo.fax || undefined,
    mobile: clientInfo.mobile || undefined,
  };
  return client;
}

interface ClientFormProps {
  client: IssueDocumentClientFieldsFragment;
  onChange: (client: IssueDocumentClientFieldsFragment) => void;
  fetching: boolean;
}

const countries = getCountryOptions();

export function ClientForm({ client, onChange, fetching }: ClientFormProps) {
  const updateClient = <T extends keyof GreenInvoiceClient>(
    field: T,
    value: GreenInvoiceClient[T],
  ) => {
    onChange({ ...client, [field]: value });
  };

  const updateEmails = (emailString: string) => {
    const emails = emailString
      .split(',')
      .map(email => email.trim())
      .filter(Boolean);
    updateClient('emails', emails);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Client Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fetching ? (
          <div>Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={client.name || ''}
                  onChange={e => updateClient('name', e.target.value)}
                  placeholder="Enter client name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID</Label>
                <Input
                  id="taxId"
                  value={client.taxId || ''}
                  onChange={e => updateClient('taxId', e.target.value)}
                  placeholder="Tax identification number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emails">Email Addresses</Label>
              <Input
                id="emails"
                value={client.emails?.join(', ') || ''}
                onChange={e => updateEmails(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={client.phone || ''}
                  onChange={e => updateClient('phone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  value={client.mobile || ''}
                  onChange={e => updateClient('mobile', e.target.value)}
                  placeholder="Mobile number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={client.address || ''}
                onChange={e => updateClient('address', e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={client.city || ''}
                  onChange={e => updateClient('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  value={client.zip || ''}
                  onChange={e => updateClient('zip', e.target.value)}
                  placeholder="ZIP code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={client.country || ''}
                  onValueChange={(value: GreenInvoiceCountry) => updateClient('country', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(country => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* <div className="flex items-center space-x-2">
          <Checkbox
            id="self"
            checked={client.self || false}
            onCheckedChange={checked => updateClient('self', checked === true)}
          />
          <Label htmlFor="self">This is a self-invoice</Label>
        </div> */}
          </>
        )}
      </CardContent>
    </Card>
  );
}
