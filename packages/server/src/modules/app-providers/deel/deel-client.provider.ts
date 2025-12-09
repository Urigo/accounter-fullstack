import { addHours, subYears } from 'date-fns';
import { Inject, Injectable, Scope } from 'graphql-modules';
import { dateToTimelessDateString } from '@shared/helpers';
import { ENVIRONMENT } from '@shared/tokens';
import { Currency } from '../../../shared/enums.js';
import type { Environment, TimelessDateString } from '../../../shared/types/index.js';
import {
  downloadInvoicePdfSchema,
  retrieveInvoicesSchema,
  retrievePaymentBreakdownSchema,
  retrievePaymentReceiptsSchema,
} from './schemas.js';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DeelClientProvider {
  private apiToken: string | null;
  private host = 'https://api.letsdeel.com/rest/v2';

  constructor(@Inject(ENVIRONMENT) private env: Environment) {
    this.apiToken = this.env.deel?.apiToken ?? null;
  }

  // This is a workaround for the Deel API returning PST dates as UTC dates.
  private timeZoneFix(dateString: string) {
    const date = new Date(dateString);
    return addHours(date, 7).toUTCString();
  }

  public async getPaymentReceipts() {
    try {
      const queryVars: {
        date_from: TimelessDateString;
        date_to: TimelessDateString;
        currencies?: Currency;
        entities?: 'company' | 'individual';
      } = {
        date_from: dateToTimelessDateString(subYears(new Date(), 1)),
        date_to: dateToTimelessDateString(new Date()),
      };
      const url = new URL(`${this.host}/payments`);
      Object.entries(queryVars).map(([key, value]) => {
        url.searchParams.set(key, value as string);
      });
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (!res.ok) {
        console.error(await res.text());
        throw new Error(`Deel API returned status ${res.status}`);
      }
      const rawData = await res.json();

      if ('errors' in rawData) {
        console.log(rawData);
        throw new Error('Deel API returned an error');
      }

      const data = retrievePaymentReceiptsSchema.parse(rawData);

      return data;
    } catch (error) {
      const message = 'Failed to fetch Deel payment receipts';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public async getPaymentBreakdown(paymentId: string) {
    try {
      const url = new URL(`${this.host}/payments/${paymentId}/breakdown`);
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (!res.ok) {
        console.error(await res.text());
        throw new Error(`Deel API returned status ${res.status}`);
      }
      const rawData = await res.json();

      if ('errors' in rawData) {
        console.log(rawData);
        throw new Error('Deel API returned an error');
      }

      const data = retrievePaymentBreakdownSchema.parse(rawData);

      return data;
    } catch (error) {
      const message = 'Failed to fetch Deel payment breakdown';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public async getSalaryInvoices() {
    try {
      const queryVars: {
        issued_from_date?: TimelessDateString;
        issued_to_date?: TimelessDateString;
        entities?: 'company' | 'individual';
        limit?: number;
        offset?: number;
      } = {
        limit: 50,
        offset: 0,
        issued_from_date: dateToTimelessDateString(subYears(new Date(), 1)),
      };
      const url = new URL(`${this.host}/invoices`);
      Object.entries(queryVars).map(([key, value]) => {
        url.searchParams.set(key, value as string);
      });
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (!res.ok) {
        console.error(await res.text());
        throw new Error(`Deel API returned status ${res.status}`);
      }
      const rawData = await res.json();

      if ('errors' in rawData) {
        console.log(rawData);
        throw new Error('Deel API returned an error');
      }

      const data = retrieveInvoicesSchema.parse(rawData);

      if (data.data.length) {
        data.data = data.data.map(invoice => {
          return {
            ...invoice,
            issued_at: this.timeZoneFix(invoice.issued_at),
            due_date: this.timeZoneFix(invoice.due_date),
          };
        });
      }

      return data;
    } catch (error) {
      const message = 'Failed to fetch Deel salary invoices';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public async getSalaryInvoiceFile(id: string) {
    try {
      const url = new URL(`${this.host}/invoices/${id}/download`);
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (!res.ok) {
        console.error(await res.text());
        throw new Error(`Deel API returned status ${res.status}`);
      }
      const rawData = await res.json();

      const data = downloadInvoicePdfSchema.parse(rawData);

      if (!data.data.url) {
        throw new Error('Deel invoice file download URL is missing');
      }

      const { body } = await fetch(data.data.url);

      if (!body) {
        throw new Error('Deel invoice file download failed');
      }

      // Read all chunks from the stream
      const chunks = [];
      for await (const chunk of body) {
        chunks.push(chunk);
      }

      // Concatenate chunks into a single buffer
      const buffer = Buffer.concat(chunks);

      // Create a Blob from the buffer
      const blob = new Blob([buffer], { type: 'application/pdf' });

      return blob;
    } catch (error) {
      const message = 'Failed to fetch Deel invoice file';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }
}
