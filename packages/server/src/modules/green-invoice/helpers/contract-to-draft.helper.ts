import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import type { IGetContractsByIdsResult } from '@modules/contracts/types.js';
import { normalizeDocumentType } from '@modules/documents/resolvers/common.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import { Currency } from '@shared/enums';
import { NewDocumentInfo } from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { getClientFromGreenInvoiceClient } from './issue-document.helper.js';

export const convertContractToDraft = async (
  contract: IGetContractsByIdsResult,
  injector: Injector,
  issueMonth: TimelessDateString,
) => {
  const businessPromise = injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.load(contract.client_id);
  const clientPromise = injector.get(ClientsProvider).getClientByIdLoader.load(contract.client_id);
  const greenInvoiceClientPromise = getClientFromGreenInvoiceClient(injector, contract.client_id);
  const [business, client, greenInvoiceClient] = await Promise.all([
    businessPromise,
    clientPromise,
    greenInvoiceClientPromise,
  ]);

  if (!business) {
    throw new GraphQLError(`Business ID="${contract.client_id}" not found`);
  }

  if (!client) {
    throw new GraphQLError(`Client not found for business ID="${contract.client_id}"`);
  }

  if (!greenInvoiceClient) {
    throw new GraphQLError(`Green invoice match not found for business ID="${contract.client_id}"`);
  }

  const today = issueMonth ? addMonths(new Date(issueMonth), 1) : new Date();
  const monthStart = dateToTimelessDateString(startOfMonth(today));
  const monthEnd = dateToTimelessDateString(endOfMonth(today));
  const year = today.getFullYear() + (today.getMonth() === 0 ? -1 : 0);
  const month = format(subMonths(today, 1), 'MMMM');

  const documentInput: NewDocumentInfo = {
    remarks: `${contract.purchase_orders[0] ? `PO: ${contract.purchase_orders[0]}${contract.remarks ? ', ' : ''}` : ''}${contract.remarks ?? ''}`,
    description: `GraphQL Hive Enterprise License - ${month} ${year}`,
    type: normalizeDocumentType(contract.document_type),
    date: monthStart,
    dueDate: monthEnd,
    lang: 'ENGLISH',
    currency: contract.currency as Currency,
    vatType: 'EXEMPT',
    rounding: false,
    signed: true,
    client: {
      ...greenInvoiceClient,
      emails: [...((client.emails?.filter(Boolean) as string[]) ?? [])],
    },
    income: [
      {
        description: `GraphQL Hive Enterprise License - ${month} ${year}`,
        quantity: 1,
        price: contract.amount,
        currency: contract.currency as Currency,
        vatType: 'EXEMPT',
      },
    ],
  };

  return documentInput;
};
