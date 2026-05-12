import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { Auth0ManagementProvider } from '../../auth/providers/auth0-management.provider.js';
import { InvitationsProvider } from '../../auth/providers/invitations.provider.js';
import { SuperAdminProvider } from '../../auth/providers/super-admin.provider.js';
import { EntityEnsureProvider } from '../../financial-entities/providers/entity-ensure.provider.js';
import type { ISetRlsContextQuery, ISetSelfOwnerQuery } from '../types.js';

export interface BootstrapClientInput {
  businessName: string;
  countryCode: string;
  locality?: string | null;
  dateEstablished?: string | null;
  initialAccounterYear?: number | null;
  ownerEmail: string;
  ownerRole: string;
}

export interface BootstrapClientResult {
  adminEntityId: string;
  invitationToken: string;
}

const setRlsContext = sql<ISetRlsContextQuery>`
  SELECT set_config('app.current_business_id', $businessId, true);
`;

const setSelfOwner = sql<ISetSelfOwnerQuery>`
  UPDATE accounter_schema.financial_entities
  SET owner_id = $id
  WHERE id = $id;
`;

@Injectable({ scope: Scope.Operation })
export class AdminOnboardingProvider {
  constructor(
    private db: TenantAwareDBClient,
    private entityEnsure: EntityEnsureProvider,
    private adminContextProvider: AdminContextProvider,
    private auth0Management: Auth0ManagementProvider,
    private invitationsProvider: InvitationsProvider,
    private superAdminProvider: SuperAdminProvider,
  ) {}

  async bootstrapNewClient(input: BootstrapClientInput): Promise<BootstrapClientResult> {
    const superAdmin = await this.superAdminProvider.requireSuperAdmin();

    return this.db.transaction(async client => {
      const {
        businessName,
        countryCode,
        locality,
        dateEstablished,
        initialAccounterYear,
        ownerEmail,
        ownerRole,
      } = input;

      // 0. Ensure country reference data (no RLS on countries table)
      await this.entityEnsure.ensureCountry(client, countryCode, countryCode);

      // 1. Determine the new admin entity's deterministic ID so we can set RLS context before inserting
      const adminEntityId = makeUUID('business', businessName);

      // Set RLS context — needed for all inserts via the tenant_isolation policy
      await setRlsContext.run({ businessId: adminEntityId }, client);

      // Insert financial_entity with owner_id=NULL first (allow_bootstrap_root policy allows
      // id = current_business_id). Then insert businesses, then update owner_id to self.
      await this.entityEnsure.ensureFinancialEntity(client, {
        id: adminEntityId,
        name: businessName,
        type: 'business',
      });

      await this.entityEnsure.ensureBusinessForEntity(client, adminEntityId, {
        ownerId: adminEntityId,
        country: countryCode,
      });

      // Update owner_id to self (allow_bootstrap_owner_update RLS policy permits this)
      await setSelfOwner.run({ id: adminEntityId }, client);

      // 2. Authority businesses
      const authorityBusinessIds: Record<string, string> = {};
      for (const name of ['VAT', 'Tax', 'Social Security']) {
        const { id } = await this.entityEnsure.ensureFinancialEntity(client, {
          name,
          type: 'business',
          ownerId: adminEntityId,
        });
        authorityBusinessIds[name] = id;
        await this.entityEnsure.ensureBusinessForEntity(client, id, {
          isDocumentsOptional: true,
          ownerId: adminEntityId,
        });
      }

      // 3. Authority tax categories
      const authorityTaxCategoryIds: Record<string, string> = {};
      for (const name of ['Input Vat', 'Output Vat', 'Property Output Vat', 'Tax Expenses']) {
        const { id } = await this.entityEnsure.ensureFinancialEntity(client, {
          name,
          type: 'tax_category',
          ownerId: adminEntityId,
        });
        authorityTaxCategoryIds[name] = id;
        await this.entityEnsure.ensureTaxCategoryForEntity(client, id, { ownerId: adminEntityId });
      }

      // 4. General tax categories
      const generalTaxCategoryIds: Record<string, string> = {};
      for (const name of [
        'DEFAULT (missing)',
        'Exchange Rates',
        'Income Exchange Rates',
        'Exchange Revaluation',
        'Fee',
        'General Fee',
        'Fine',
        'Untaxable Gifts',
        'Balance Cancellation',
        'Development Foreign',
        'Development Local',
        'Salary Excess Expenses',
      ]) {
        const { id } = await this.entityEnsure.ensureFinancialEntity(client, {
          name,
          type: 'tax_category',
          ownerId: adminEntityId,
        });
        generalTaxCategoryIds[name] = id;
        await this.entityEnsure.ensureTaxCategoryForEntity(client, id, { ownerId: adminEntityId });
      }

      // 5. Cross-year tax categories
      const crossYearTaxCategoryIds: Record<string, string> = {};
      for (const name of [
        'Expenses to Pay',
        'Expenses in Advance',
        'Income to Collect',
        'Income in Advance',
      ]) {
        const { id } = await this.entityEnsure.ensureFinancialEntity(client, {
          name,
          type: 'tax_category',
          ownerId: adminEntityId,
        });
        crossYearTaxCategoryIds[name] = id;
        await this.entityEnsure.ensureTaxCategoryForEntity(client, id, { ownerId: adminEntityId });
      }

      // 6. Insert user_context — dynamic column list, cannot use PgTyped
      const contextCols = {
        owner_id: adminEntityId,
        default_local_currency: 'ILS',
        default_fiat_currency_for_crypto_conversions: 'USD',
        locality: locality ?? 'ISR',
        default_tax_category_id: generalTaxCategoryIds['DEFAULT (missing)'],
        vat_business_id: authorityBusinessIds['VAT'],
        input_vat_tax_category_id: authorityTaxCategoryIds['Input Vat'],
        output_vat_tax_category_id: authorityTaxCategoryIds['Output Vat'],
        property_output_vat_tax_category_id: authorityTaxCategoryIds['Property Output Vat'],
        tax_business_id: authorityBusinessIds['Tax'],
        tax_expenses_tax_category_id: authorityTaxCategoryIds['Tax Expenses'],
        social_security_business_id: authorityBusinessIds['Social Security'],
        exchange_rate_tax_category_id: generalTaxCategoryIds['Exchange Rates'],
        income_exchange_rate_tax_category_id: generalTaxCategoryIds['Income Exchange Rates'],
        exchange_rate_revaluation_tax_category_id: generalTaxCategoryIds['Exchange Revaluation'],
        fee_tax_category_id: generalTaxCategoryIds['Fee'],
        general_fee_tax_category_id: generalTaxCategoryIds['General Fee'],
        fine_tax_category_id: generalTaxCategoryIds['Fine'],
        untaxable_gifts_tax_category_id: generalTaxCategoryIds['Untaxable Gifts'],
        balance_cancellation_tax_category_id: generalTaxCategoryIds['Balance Cancellation'],
        development_foreign_tax_category_id: generalTaxCategoryIds['Development Foreign'],
        development_local_tax_category_id: generalTaxCategoryIds['Development Local'],
        expenses_to_pay_tax_category_id: crossYearTaxCategoryIds['Expenses to Pay'],
        expenses_in_advance_tax_category_id: crossYearTaxCategoryIds['Expenses in Advance'],
        income_to_collect_tax_category_id: crossYearTaxCategoryIds['Income to Collect'],
        income_in_advance_tax_category_id: crossYearTaxCategoryIds['Income in Advance'],
        salary_excess_expenses_tax_category_id: generalTaxCategoryIds['Salary Excess Expenses'],
        ...(dateEstablished ? { date_established: dateEstablished } : {}),
        ...(initialAccounterYear ? { initial_accounter_year: initialAccounterYear } : {}),
      };

      const columns = Object.keys(contextCols).join(', ');
      const placeholders = Object.keys(contextCols)
        .map((_, i) => `$${i + 1}`)
        .join(', ');
      await client.query(
        `INSERT INTO accounter_schema.user_context (${columns}) VALUES (${placeholders}) ON CONFLICT (owner_id) DO NOTHING`,
        Object.values(contextCols),
      );

      // 7. Create Auth0 user (blocked) + invitation
      const auth0UserId = await this.auth0Management.createBlockedUser(ownerEmail);

      const invitation = await this.invitationsProvider.insertInvitation({
        email: ownerEmail,
        roleId: ownerRole,
        auth0UserId,
        invitedByUserId: superAdmin.userId,
        ownerId: adminEntityId,
      });

      return {
        adminEntityId,
        invitationToken: invitation.token,
      };
    });
  }

  async getBootstrapResult(adminEntityId: string) {
    const adminContext = await this.adminContextProvider.getAdminContextByOwnerId(adminEntityId);
    if (!adminContext) {
      throw new GraphQLError('Admin context not found after bootstrap', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
    return adminContext;
  }
}
