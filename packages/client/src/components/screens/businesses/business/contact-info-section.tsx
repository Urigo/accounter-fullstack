import { Globe, Mail, MapPin, Phone, Save } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea.js';

export function ContactInfoSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Information</CardTitle>
        <CardDescription>Business contact details and address information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input id="business-name" defaultValue="Acme Corporation" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-name">Legal Name</Label>
            <Input id="legal-name" defaultValue="Acme Corporation Ltd." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <Input id="email" type="email" defaultValue="contact@acmecorp.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            <Input id="phone" type="tel" defaultValue="+1 (555) 123-4567" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Website
            </Label>
            <Input id="website" type="url" defaultValue="https://acmecorp.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-id">Tax ID / VAT Number</Label>
            <Input id="tax-id" defaultValue="123-45-6789" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Business Address
            </Label>
            <Textarea
              id="address"
              rows={3}
              defaultValue="123 Business Street, Suite 100&#10;San Francisco, CA 94105&#10;United States"
            />
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
