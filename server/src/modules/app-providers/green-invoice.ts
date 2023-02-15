import { config } from 'dotenv';
import { Injectable, Scope } from 'graphql-modules';
import { init, Sdk } from '@accounter-toolkit/green-invoice-graphql';

config();

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class GreenInvoiceProvider {
  private greenInvoiceSdk: Sdk | undefined;

  public async init() {
    try {
      const id = process.env['GREEN_INVOICE_ID'] as string;
      const secret = process.env['GREEN_INVOICE_SECRET'] as string;

      if (!this.greenInvoiceSdk) {
        this.greenInvoiceSdk = (await init(id, secret)).sdk;
        console.log('Green Invoice SDK initialized');
      }
    } catch (err) {
      console.error(`Green Invoice initiation error:\n${err}`);
    }
  }

  public getSDK() {
    if (!this.greenInvoiceSdk) {
      throw new Error('Green Invoice SDK not initialized');
    }
    return this.greenInvoiceSdk;
  }
}
