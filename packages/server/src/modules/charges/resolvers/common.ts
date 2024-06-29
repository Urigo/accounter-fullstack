import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { ChargeResolvers } from '@shared/gql-types';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { validateCharge } from '../helpers/validate.helper.js';
import { ChargeRequiredWrapper, ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule, IGetChargesByIdsResult } from '../types.js';

const calculateTotalAmount: ChargeResolvers['totalAmount'] = async charge => {
  if (charge.is_salary && charge.transactions_event_amount != null) {
    return formatFinancialAmount(charge.transactions_event_amount, DEFAULT_LOCAL_CURRENCY);
  }
  if (charge.documents_event_amount != null && charge.documents_currency) {
    return formatFinancialAmount(charge.documents_event_amount, charge.documents_currency);
  }
  if (charge.transactions_event_amount != null && charge.transactions_currency) {
    return formatFinancialAmount(charge.transactions_event_amount, charge.transactions_currency);
  }
  return null;
};

export const commonChargeFields: ChargesModule.ChargeResolvers = {
  id: DbCharge => DbCharge.id,
  vat: DbCharge =>
    DbCharge.documents_vat_amount != null && DbCharge.documents_currency
      ? formatFinancialAmount(DbCharge.documents_vat_amount, DbCharge.documents_currency)
      : null,
  totalAmount: calculateTotalAmount,
  property: DbCharge => DbCharge.is_property,
  conversion: DbCharge => DbCharge.type === 'CONVERSION' ?? false,
  salary: DbCharge => DbCharge.type === 'PAYROLL' ?? false,
  isInvoicePaymentDifferentCurrency: DbCharge => DbCharge.invoice_payment_currency_diff,
  userDescription: DbCharge => DbCharge.user_description,
  minEventDate: DbCharge => DbCharge.transactions_min_event_date,
  minDebitDate: DbCharge => DbCharge.transactions_min_debit_date,
  minDocumentsDate: DbCharge => DbCharge.documents_min_date,
  validationData: (DbCharge, _, { injector }) => validateCharge(DbCharge, injector),
  metadata: DbCharge => DbCharge,
  yearsOfRelevance: DbCharge =>
    DbCharge.years_of_relevance
      ? DbCharge.years_of_relevance.map(date => dateToTimelessDateString(date))
      : null,
};

export const commonDocumentsFields: ChargesModule.DocumentResolvers = {
  charge: async (documentRoot, _, { injector }) => {
    if (!documentRoot.charge_id_new) {
      return null;
    }
    const charge = await injector
      .get(ChargesProvider)
      .getChargeByIdLoader.load(documentRoot.charge_id_new);
    return charge ?? null;
  },
};

export const commonFinancialAccountFields:
  | ChargesModule.CardFinancialAccountResolvers
  | ChargesModule.BankFinancialAccountResolvers = {
  charges: async (DbAccount, { filter }, { injector }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await injector
        .get(ChargesProvider)
        .getChargeByFinancialAccountIDsLoader.load(DbAccount.id);
      return charges;
    }
    const charges = await injector.get(ChargesProvider).getChargesByFinancialAccountIds({
      financialAccountIDs: [DbAccount.id],
      fromDate: filter?.fromDate,
      toDate: filter?.toDate,
    });
    return charges;
  },
};

export const commonFinancialEntityFields:
  | ChargesModule.LtdFinancialEntityResolvers
  | ChargesModule.PersonalFinancialEntityResolvers = {
  charges: async (DbBusiness, { filter, page, limit }, { injector }) => {
    const charges: ChargeRequiredWrapper<IGetChargesByIdsResult>[] = [];
    if (!filter || Object.keys(filter).length === 0) {
      const newCharges = await injector
        .get(ChargesProvider)
        .getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      charges.push(...newCharges);
    } else {
      const newCharges = await injector.get(ChargesProvider).getChargesByFinancialEntityIds({
        ownerIds: [DbBusiness.id],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      });
      charges.push(...newCharges);
    }
    return {
      __typename: 'PaginatedCharges',
      nodes: charges.slice(page * limit - limit, page * limit),
      pageInfo: {
        totalPages: Math.ceil(charges.length / limit),
      },
    };
  },
};
