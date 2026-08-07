import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { _DOLLAR_defs_Country } from '@accounter/green-invoice-graphql';
import { parseUniformFormatFiles } from '@accounter/shaam-uniform-format-generator';
import { CountryCode } from '../../../shared/enums.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import {
  IInsertBusinessesParams,
  IInsertFinancialEntitiesParams,
} from '../../financial-entities/types.js';
import { greenInvoiceCountryToCountryCode } from '../../green-invoice/helpers/green-invoice.helper.js';
import { SortCodesProvider } from '../../sort-codes/providers/sort-codes.provider.js';

export interface ImportShaamFileResult {
  insertedSortCodesCount: number;
  insertedBusinessesCount: number;
}

@Injectable({ scope: Scope.Operation })
export class ShaamImportProvider {
  constructor(
    private db: TenantAwareDBClient,
    private sortCodesProvider: SortCodesProvider,
    private businessProvider: BusinessesProvider,
    private financialEntitiesProvider: FinancialEntitiesProvider,
  ) {}

  async importShaamFile(
    ownerId: string,
    bkmvdataContent: string,
    iniContent: string | null,
  ): Promise<ImportShaamFileResult> {
    const parseResult = parseUniformFormatFiles(iniContent ?? '', bkmvdataContent, {
      validationMode: 'strict',
    });

    if (parseResult.summary.errors.some(e => e.severity === 'error')) {
      const messages = parseResult.summary.errors
        .filter(e => e.severity === 'error')
        .map(e => `[${e.recordType}] ${e.field}: ${e.message}`)
        .join('; ');
      throw new GraphQLError(`SHAAM file validation failed: ${messages}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const accounts = parseResult.data.accounts;

    // Collect unique sort codes by key
    const sortCodeMap = new Map<number, string | undefined>();
    for (const account of accounts) {
      const key = account.sortCode.key ? parseInt(account.sortCode.key, 10) : NaN;
      if (!Number.isNaN(key) && !sortCodeMap.has(key)) {
        sortCodeMap.set(key, account.sortCode.name ?? undefined);
      }
    }

    return this.db.transaction(async client => {
      // Override RLS context to the target owner so inserts pass the tenant_isolation policy
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [ownerId]);

      // Insert sort codes that don't exist yet
      const existingSortCodes =
        await this.sortCodesProvider.getSortCodesByOwnerIdLoader.load(ownerId);
      const existingKeys = new Set(existingSortCodes.map(sc => sc.key));

      const newSortCodes = [...sortCodeMap]
        .filter(([key]) => !existingKeys.has(key))
        .map(([key, name]) => ({ key, name: name ?? null, defaultIrsCode: null, ownerId }));

      if (newSortCodes.length > 0) {
        await this.sortCodesProvider.addSortCodes({ sortCodes: newSortCodes }, client);
      }

      const insertedSortCodesCount = newSortCodes.length;

      // Insert a business entity for each account
      let insertedBusinessesCount = 0;
      for (const account of accounts) {
        const addressStreet = account.address?.street
          ? [account.address.street, account.address.houseNumber].filter(Boolean).join(' ')
          : undefined;

        const financialEntity: IInsertFinancialEntitiesParams['financialEntities'][number] = {
          ownerId,
          name: account.name ?? account.id,
          sortCode: account.sortCode?.key ? parseInt(account.sortCode.key, 10) : null,
          type: 'business',
          irsCode: account.accountingClassificationCode
            ? parseInt(account.accountingClassificationCode, 10)
            : null,
          isActive: true,
        };

        try {
          const [{ id: financialEntityId } = {}] =
            await this.financialEntitiesProvider.insertFinancialEntity(financialEntity, client);

          if (!financialEntityId) {
            throw new GraphQLError(
              `Failed to insert financial entity for account "${account.name ?? account.id}"`,
            );
          }

          // if account.name includes Hebrew characters, use it as the hebrewName, otherwise leave hebrewName null
          const hebrewName = /[\u0590-\u05FF]/.test(account.name ?? '') ? account.name : undefined;

          let country: CountryCode = CountryCode.Israel;
          if (account.countryCode) {
            try {
              country = greenInvoiceCountryToCountryCode(
                account.countryCode as _DOLLAR_defs_Country,
              );
            } catch {
              console.warn(
                `Unknown country code "${account.countryCode}" for account "${account.name ?? account.id}", skipping country mapping`,
              );
            }
          }

          const business: IInsertBusinessesParams['businesses'][number] = {
            id: financialEntityId,
            ownerId,
            address: addressStreet,
            city: account.address?.city ?? undefined,
            zipCode: account.address?.zip ?? undefined,
            email: null,
            exemptDealer: false,
            governmentId: account.vatId ?? undefined,
            hebrewName,
            phoneNumber: null,
            website: null,
            optionalVat: false,
            isReceiptEnough: false,
            isDocumentsOptional: false,
            country,
            suggestions: null,
            pcn874RecordTypeOverride: null,
            bankAccountBankNumber: null,
            bankAccountBranchNumber: null,
            bankAccountAccountNumber: null,
          };
          await this.businessProvider.insertBusiness(business, client);

          insertedBusinessesCount++;
        } catch (e) {
          console.error(`Error ensuring business for entity ${financialEntity.name}`, e);
          throw new GraphQLError(
            `Error ensuring business for account "${financialEntity.name}": ${
              (e as Error)?.message ?? 'Unknown error'
            }`,
          );
        }
      }

      return { insertedSortCodesCount, insertedBusinessesCount };
    });
  }
}
