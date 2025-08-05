'use client';

import { User } from 'lucide-react';
import { GreenInvoiceCountry } from '../../../../gql/graphql.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card.jsx';
import { Checkbox } from '../../../ui/checkbox.jsx';
import { Input } from '../../../ui/input.jsx';
import { Label } from '../../../ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.jsx';
import type { Client } from './types/document.js';
import { getCountryOptions } from './utils/enum-helpers.js';

interface ClientFormProps {
  client: Client;
  onChange: (client: Client) => void;
}

const countries = getCountryOptions();

export function ClientForm({ client, onChange }: ClientFormProps) {
  const updateClient = <T extends keyof Client>(field: T, value: Client[T]) => {
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="self"
            checked={client.self || false}
            onCheckedChange={checked => updateClient('self', checked === true)}
          />
          <Label htmlFor="self">This is a self-invoice</Label>
        </div>
      </CardContent>
    </Card>
  );
}
