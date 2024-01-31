import { Inject, Injectable, Scope } from 'graphql-modules';
import { init, Sdk } from '@accounter-toolkit/green-invoice-graphql';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class GreenInvoiceProvider {
  constructor(@Inject(ENVIRONMENT) private env: Environment) {}

  private greenInvoiceSdk: Sdk | undefined;

  public async init() {
    try {
      const id = this.env.greenInvoice.id;
      const secret = this.env.greenInvoice.secret;

      if (id && secret) {
        if (!this.greenInvoiceSdk) {
          this.greenInvoiceSdk = (await init(id, secret)).sdk;
          console.log('Green Invoice SDK initialized');
        }
      } else {
        throw new Error('Environment variables not found');
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
