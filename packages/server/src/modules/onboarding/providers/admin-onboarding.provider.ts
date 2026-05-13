import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { AdminContext } from '../../admin-context/types.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { Auth0ManagementProvider } from '../../auth/providers/auth0-management.provider.js';
import { BusinessUsersProvider } from '../../auth/providers/business-users.provider.js';
import { InvitationsProvider } from '../../auth/providers/invitations.provider.js';
import { SuperAdminProvider } from '../../auth/providers/super-admin.provider.js';
import { AdminBusinessesProvider } from '../../financial-entities/providers/admin-businesses.provider.js';
import { EntityEnsureProvider } from '../../financial-entities/providers/entity-ensure.provider.js';
import type {
  IExpireActiveInvitationsQuery,
  IGetBootstrapBusinessQuery,
  IGetBootstrapBusinessResult,
  IGetBootstrapContextQuery,
  ISetRlsContextQuery,
  ISetSelfOwnerQuery,
} from '../types.js';

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
  business: IGetBootstrapBusinessResult;
  adminContext: AdminContext;
}

const setRlsContext = sql<ISetRlsContextQuery>`
  SELECT set_config('app.current_business_id', $businessId, true);
`;

const setSelfOwner = sql<ISetSelfOwnerQuery>`
  UPDATE accounter_schema.financial_entities
  SET owner_id = $id
  WHERE id = $id;
`;

const getBootstrapBusiness = sql<IGetBootstrapBusinessQuery>`
  SELECT fe.*, b.vat_number, b.hebrew_name, b.address, b.address_hebrew, b.email,
         b.website, b.phone_number, b.country, b.no_invoices_required, b.suggestion_data,
         b.can_settle_with_receipt, b.exempt_dealer, b.optional_vat,
         b.pcn874_record_type_override, b.city, b.zip_code
  FROM accounter_schema.businesses b
  INNER JOIN accounter_schema.financial_entities fe USING (id)
  WHERE b.id = $id;
`;

const getBootstrapContext = sql<IGetBootstrapContextQuery>`
  SELECT * FROM accounter_schema.user_context
  WHERE owner_id = $ownerId;
`;

const expireActiveInvitations = sql<IExpireActiveInvitationsQuery>`
  UPDATE accounter_schema.invitations
  SET expires_at = NOW(), accepted_at = NOW()
  WHERE business_id = $businessId
    AND lower(email) = lower($email)
    AND accepted_at IS NULL
    AND expires_at > NOW();
`;

@Injectable({ scope: Scope.Operation })
export class AdminOnboardingProvider {
  constructor(
    private db: TenantAwareDBClient,
    private entityEnsure: EntityEnsureProvider,
    private adminContextProvider: AdminContextProvider,
    private businessUsersProvider: BusinessUsersProvider,
    private adminBusinessesProvider: AdminBusinessesProvider,
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
      await this.entityEnsure.ensureCountry(countryCode, countryCode, client);

      // 1. Determine the new admin entity's deterministic ID so we can set RLS context before inserting
      const adminEntityId = makeUUID('business', businessName);

      // Set RLS context — needed for all inserts via the tenant_isolation policy
      await setRlsContext.run({ businessId: adminEntityId }, client);

      // Insert financial_entity with owner_id=NULL first (allow_bootstrap_root policy allows
      // id = current_business_id). Then insert businesses, then update owner_id to self.
      await this.entityEnsure.ensureFinancialEntity(
        {
          id: adminEntityId,
          name: businessName,
          type: 'business',
        },
        client,
      );

      await this.entityEnsure.ensureBusinessForEntity(
        adminEntityId,
        {
          ownerId: adminEntityId,
          country: countryCode,
        },
        client,
      );

      // Update owner_id to self (allow_bootstrap_owner_update RLS policy permits this)
      await setSelfOwner.run({ id: adminEntityId }, client);

      // Register as an admin-managed business (required for business_users FK)
      await this.adminBusinessesProvider.insertAdminBusiness(adminEntityId, client);

      // 2. Authority businesses
      const authorityBusinessIds: Record<string, string> = {};
      for (const name of ['VAT', 'Tax', 'Social Security']) {
        const { id } = await this.entityEnsure.ensureFinancialEntity(
          {
            name,
            type: 'business',
            ownerId: adminEntityId,
          },
          client,
        );
        authorityBusinessIds[name] = id;
        await this.entityEnsure.ensureBusinessForEntity(
          id,
          {
            isDocumentsOptional: true,
            ownerId: adminEntityId,
          },
          client,
        );
      }

      // 3. Authority tax categories
      const authorityTaxCategoryIds: Record<string, string> = {};
      for (const name of ['Input Vat', 'Output Vat', 'Property Output Vat', 'Tax Expenses']) {
        const { id } = await this.entityEnsure.ensureFinancialEntity(
          {
            name,
            type: 'tax_category',
            ownerId: adminEntityId,
          },
          client,
        );
        authorityTaxCategoryIds[name] = id;
        await this.entityEnsure.ensureTaxCategoryForEntity(id, { ownerId: adminEntityId }, client);
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
        const { id } = await this.entityEnsure.ensureFinancialEntity(
          {
            name,
            type: 'tax_category',
            ownerId: adminEntityId,
          },
          client,
        );
        generalTaxCategoryIds[name] = id;
        await this.entityEnsure.ensureTaxCategoryForEntity(id, { ownerId: adminEntityId }, client);
      }

      // 5. Cross-year tax categories
      const crossYearTaxCategoryIds: Record<string, string> = {};
      for (const name of [
        'Expenses to Pay',
        'Expenses in Advance',
        'Income to Collect',
        'Income in Advance',
      ]) {
        const { id } = await this.entityEnsure.ensureFinancialEntity(
          {
            name,
            type: 'tax_category',
            ownerId: adminEntityId,
          },
          client,
        );
        crossYearTaxCategoryIds[name] = id;
        await this.entityEnsure.ensureTaxCategoryForEntity(id, { ownerId: adminEntityId }, client);
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
      // Expire any standing invitations so insertInvitation can create a fresh one
      await expireActiveInvitations.run({ businessId: adminEntityId, email: ownerEmail }, client);

      const auth0UserId = await this.auth0Management.createBlockedUser(ownerEmail);

      await this.businessUsersProvider.insertBusinessUser({
        userId: superAdmin.userId,
        auth0UserId: superAdmin.auth0UserId,
        roleId: ownerRole,
        ownerId: adminEntityId,
      });

      const { token: invitationToken } = await this.invitationsProvider.insertInvitation({
        email: ownerEmail,
        roleId: ownerRole,
        auth0UserId,
        invitedByUserId: superAdmin.userId,
        ownerId: adminEntityId,
      });

      // 8. Fetch business and adminContext while RLS context is still set to adminEntityId
      const [businessResults, contextResults] = await Promise.all([
        getBootstrapBusiness.run({ id: adminEntityId }, client),
        getBootstrapContext.run({ ownerId: adminEntityId }, client),
      ]);

      const business = businessResults[0];
      if (!business) {
        throw new GraphQLError('Admin business not found after bootstrap', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const rawContext = contextResults[0];
      if (!rawContext) {
        throw new GraphQLError('Admin context not found after bootstrap', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminContext = this.adminContextProvider.normalizeContext(rawContext);

      return {
        adminEntityId,
        invitationToken,
        business,
        adminContext,
      };
    });
  }
}
