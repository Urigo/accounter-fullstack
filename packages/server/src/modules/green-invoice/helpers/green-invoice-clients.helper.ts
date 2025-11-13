import { Injector } from 'graphql-modules';
import {
  _DOLLAR_defs_addClientRequest_Input,
  _DOLLAR_defs_updateClientRequest_Input,
} from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { CountryCode } from '@modules/countries/types.js';
import { validateClientIntegrations } from '@modules/financial-entities/helpers/clients.helper.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import {
  IGetBusinessesByIdsResult,
  IGetClientsByIdsResult,
} from '@modules/financial-entities/types.js';
import { ClientUpdateInput, UpdateBusinessInput } from '@shared/gql-types';
import { countryCodeToGreenInvoiceCountry } from './green-invoice.helper.js';

function convertLocalClientToGreenInvoiceCreateClientInput(
  localClient: IGetClientsByIdsResult,
  localBusiness: IGetBusinessesByIdsResult,
): _DOLLAR_defs_addClientRequest_Input {
  return {
    /** Phone number */
    phone: localBusiness.phone_number,
    /** Mobile number */
    // mobile: localBusiness.mobile_number,
    /** Email addresses */
    emails: localClient.emails,
    /** Fax number */
    // fax: localBusiness.fax_number,
    /** Contact person name */
    //   contactPerson: localBusiness.contact_person,
    /** Street address */
    address: localBusiness.address,
    /** City name */
    //   city: localBusiness.city,
    /** Zip/postal code */
    //   zip: localBusiness.zip_code,
    country: countryCodeToGreenInvoiceCountry(localBusiness.country as CountryCode),
    /** Bank name */
    //   bankName: localBusiness.bank_name,
    /** Bank branch number */
    //   bankBranch: localBusiness.bank_branch_number,
    /** Bank account number */
    //   bankAccount: localBusiness.bank_account_number,
    /** The client name */
    name: localBusiness.name,
    /** Is the client currently active or not */
    active: localBusiness.is_active,
    /** The client tax ID */
    //   taxId: localBusiness.tax_id
    //   paymentTerms: localClient.payment_terms,
    //   labels: localClient.labels,
    /** Whether to send emails to the user automatically when assigning him to an invoice or not */
    //   send: localClient.send,
    /** The client department */
    //   department: localClient.department,
    /** The client accounting key */
    accountingKey: localBusiness.sort_code?.toString(),
    /** The category this client is related to */
    //   category: localClient.category,
    /** The sub category this client is related to */
    //   subCategory: localClient.sub_category,
    /** Client remarks for self use */
    //   remarks: localClient.remarks,
  };
}

export async function addGreenInvoiceClient(clientId: string, injector: Injector): Promise<void> {
  try {
    // validate local client
    const localBusinessPromise = injector
      .get(BusinessesProvider)
      .getBusinessByIdLoader.load(clientId);
    const localClientPromise = injector.get(ClientsProvider).getClientByIdLoader.load(clientId);
    const [localBusiness, localClient] = await Promise.all([
      localBusinessPromise,
      localClientPromise,
    ]);
    if (!localBusiness) {
      throw new Error('Business not found');
    }
    if (!localClient) {
      throw new Error('Client not found');
    }

    // validate details
    const greenInvoiceCreatClientInput = convertLocalClientToGreenInvoiceCreateClientInput(
      localClient,
      localBusiness,
    );

    // add to green invoice
    const greenInvoiceClient = await injector
      .get(GreenInvoiceClientProvider)
      .createClient(greenInvoiceCreatClientInput);

    if (!greenInvoiceClient?.id) {
      throw new Error('Failed to create Green Invoice client');
    }

    const integrations = validateClientIntegrations(localClient.integrations);

    // add green invoice id to local client
    await injector.get(ClientsProvider).updateClient({
      businessId: clientId,
      integrations: {
        ...integrations,
        greenInvoiceId: greenInvoiceClient.id,
      },
    });
  } catch (error) {
    const message = 'Error adding Green Invoice client';
    console.error(`${message}: ${error}`);
    throw new Error(message);
  }
}

function pickGreenInvoiceClientFields(
  businessFields: Omit<UpdateBusinessInput, 'id'> & { name: string },
  clientFields: ClientUpdateInput,
): _DOLLAR_defs_updateClientRequest_Input {
  const fieldsToUpdate: _DOLLAR_defs_updateClientRequest_Input = {
    /** Phone number */
    phone: businessFields.phoneNumber,
    /** Mobile number */
    // mobile: businessFields.mobile_number,
    /** Email addresses */
    emails: clientFields.emails ? [...clientFields.emails] : undefined,
    /** Fax number */
    // fax: businessFields.fax_number,
    /** Contact person name */
    //   contactPerson: businessFields.contact_person,
    /** Street address */
    address: businessFields.address ?? undefined,
    /** City name */
    //   city: businessFields.city,
    /** Zip/postal code */
    //   zip: businessFields.zip_code,
    country: businessFields.country
      ? countryCodeToGreenInvoiceCountry(businessFields.country as CountryCode)
      : undefined,
    /** Bank name */
    //   bankName: businessFields.bank_name,
    /** Bank branch number */
    //   bankBranch: businessFields.bank_branch_number,
    /** Bank account number */
    //   bankAccount: businessFields.bank_account_number,
    /** The client name */
    name: businessFields.name ?? undefined,
    /** Is the client currently active or not */
    active: businessFields.isActive,
    /** The client tax ID */
    taxId: businessFields.governmentId,
    //   paymentTerms: clientFields.payment_terms,
    //   labels: clientFields.labels,
    /** Whether to send emails to the user automatically when assigning him to an invoice or not */
    //   send: clientFields.send,
    /** The client department */
    //   department: clientFields.department,
    /** The client accounting key */
    accountingKey: businessFields.sortCode?.toString(),
    /** The category this client is related to */
    //   category: clientFields.category,
    /** The sub category this client is related to */
    //   subCategory: clientFields.sub_category,
    /** Client remarks for self use */
    //   remarks: clientFields.remarks,
  };

  return fieldsToUpdate;
}

export async function updateGreenInvoiceClient(
  clientId: string,
  injector: Injector,
  businessFields: UpdateBusinessInput = {},
  clientFields: ClientUpdateInput = {},
): Promise<void> {
  // validate local client
  const localBusinessPromise = injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.load(clientId);
  const localClientPromise = injector.get(ClientsProvider).getClientByIdLoader.load(clientId);
  const [localBusiness, localClient] = await Promise.all([
    localBusinessPromise,
    localClientPromise,
  ]);

  let greenInvoiceId: string | undefined = undefined;
  try {
    greenInvoiceId =
      validateClientIntegrations(localClient?.integrations ?? {}).greenInvoiceId ?? undefined;
  } catch {
    // swallow errors
    return;
  }
  if (!localBusiness?.name || !greenInvoiceId) {
    // We cannot update a client in Green Invoice without its ID.
    console.warn(
      `Cannot update Green Invoice client: missing local business name or client ID for business${clientId}`,
    );
    return;
  }

  const fieldsToUpdate = pickGreenInvoiceClientFields(
    { ...businessFields, name: localBusiness.name },
    clientFields,
  );
  if (Object.keys(fieldsToUpdate).length === 0) {
    return;
  }

  const greenInvoiceClient = await injector.get(GreenInvoiceClientProvider).updateClient({
    id: greenInvoiceId,
    input: fieldsToUpdate,
  });

  if (!greenInvoiceClient?.id) {
    throw new Error('Failed to create Green Invoice client');
  }

  return;
}
