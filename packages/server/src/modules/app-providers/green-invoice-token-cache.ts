import { Injectable, Scope } from 'graphql-modules';
import {
  GreenInvoiceTokenCache,
  type GetTokenOptions,
  type GreenInvoiceTokenSource,
} from '@accounter/green-invoice-graphql';

/**
 * App-wide Green Invoice access-token cache, keyed by API key ID. Shared by the operation-scoped
 * `GreenInvoiceClientProvider`, so operations reuse a token until shortly before it expires instead
 * of requesting a new one each time.
 */
@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class GreenInvoiceTokenCacheProvider implements GreenInvoiceTokenSource {
  // created on first use, so the app can be built without touching the Green Invoice package
  private cache: GreenInvoiceTokenCache | null = null;

  private get tokenCache(): GreenInvoiceTokenCache {
    this.cache ??= new GreenInvoiceTokenCache();
    return this.cache;
  }

  public get epoch(): number {
    return this.tokenCache.epoch;
  }

  public getToken(id: string, secret: string, options?: GetTokenOptions): Promise<string> {
    return this.tokenCache.getToken(id, secret, options);
  }

  public invalidate(id: string, token?: string): void {
    this.tokenCache.invalidate(id, token);
  }
}
