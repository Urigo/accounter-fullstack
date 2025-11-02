import { Injector } from 'graphql-modules';
import { _DOLLAR_defs_addClientRequest_Input } from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { CountryCode } from '@modules/countries/types.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import {
  IGetBusinessesByIdsResult,
  IGetClientsByIdsResult,
} from '@modules/financial-entities/types.js';
import { GreenInvoiceClient } from '@shared/gql-types';
import { countryCodeToGreenInvoiceCountry } from './green-invoice.helper.js';

export async function getClientFromGreenInvoiceClient(
  injector: Injector,
  businessId: string,
  useGreenInvoiceId = false,
): Promise<GreenInvoiceClient | undefined> {
  const client = await injector.get(ClientsProvider).getClientByIdLoader.load(businessId);
  if (!client) {
    return useGreenInvoiceId ? undefined : { id: businessId };
  }

  const greenInvoiceClient = await injector
    .get(GreenInvoiceClientProvider)
    .clientLoader.load(client.green_invoice_id);

  if (!greenInvoiceClient) {
    return useGreenInvoiceId ? undefined : { id: businessId };
  }

  return {
    id: useGreenInvoiceId && greenInvoiceClient.id ? greenInvoiceClient.id : businessId,
    country: greenInvoiceClient.country,
    emails: [
      ...((greenInvoiceClient.emails?.filter(Boolean) as string[]) ?? []),
      'ap@the-guild.dev',
    ],
    name: greenInvoiceClient.name,
    phone: greenInvoiceClient.phone,
    taxId: greenInvoiceClient.taxId,
    address: greenInvoiceClient.address,
    city: greenInvoiceClient.city,
    zip: greenInvoiceClient.zip,
    fax: greenInvoiceClient.fax,
    mobile: greenInvoiceClient.mobile,
  };
}

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

export async function addGreenInvoiceClient(clientId: string, injector: Injector) {
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

    // add green invoice id to local client
    await injector.get(ClientsProvider).updateClient({
      businessId: clientId,
      greenInvoiceId: greenInvoiceClient.id,
    });
  } catch (error) {
    console.error('Error adding Green Invoice client:', error);
  }
}

export async function updateGreenInvoiceClient(
  injector: Injector,
  businessId: string,
  useGreenInvoiceId = false,
): Promise<GreenInvoiceClient | undefined> {
  const client = await injector.get(ClientsProvider).getClientByIdLoader.load(businessId);
  if (!client) {
    return useGreenInvoiceId ? undefined : { id: businessId };
  }

  const greenInvoiceClient = await injector
    .get(GreenInvoiceClientProvider)
    .clientLoader.load(client.green_invoice_id);

  if (!greenInvoiceClient) {
    return useGreenInvoiceId ? undefined : { id: businessId };
  }

  return {
    id: useGreenInvoiceId && greenInvoiceClient.id ? greenInvoiceClient.id : businessId,
    country: greenInvoiceClient.country,
    emails: [
      ...((greenInvoiceClient.emails?.filter(Boolean) as string[]) ?? []),
      'ap@the-guild.dev',
    ],
    name: greenInvoiceClient.name,
    phone: greenInvoiceClient.phone,
    taxId: greenInvoiceClient.taxId,
    address: greenInvoiceClient.address,
    city: greenInvoiceClient.city,
    zip: greenInvoiceClient.zip,
    fax: greenInvoiceClient.fax,
    mobile: greenInvoiceClient.mobile,
  };
}
