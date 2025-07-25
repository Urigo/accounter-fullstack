import { GraphQLError } from 'graphql';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { IGetTagsByIDsResult } from '@modules/tags/types.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { UUID_REGEX } from '@shared/constants';
import { ChargeTypeEnum } from '@shared/enums';
import type {
  ChargeResolvers,
  Maybe,
  Resolver,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { formatAmount } from '@shared/helpers';
import { getChargeType } from '../../helpers/charge-type.js';
import type { ChargesModule } from '../../types.js';
import { missingConversionInfoSuggestions } from './conversion-suggeestions.resolver.js';

type SuggestionData = {
  description?: string;
  tags: Array<string>;
  phrases: Array<string>;
};

export type Suggestion = Awaited<ResolversTypes['ChargeSuggestions']>;

const missingInfoSuggestions: Resolver<
  Maybe<Suggestion>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context
> = async (DbCharge, _, context, __) => {
  // if all required fields are filled, no need for suggestions
  if (!!DbCharge.tags?.length && !!DbCharge.user_description?.trim()) {
    return null;
  }

  const { injector, adminContext } = context;
  const { poalimBusinessId, etherScanBusinessId, krakenBusinessId, etanaBusinessId } =
    adminContext.financialAccounts;

  const chargeType = getChargeType(DbCharge, context);

  if (chargeType === ChargeTypeEnum.Conversion) {
    return missingConversionInfoSuggestions(DbCharge, _, context, __);
  }

  // if charge has a businesses, use it's suggestion data
  if (DbCharge.business_id) {
    const business = await injector
      .get(BusinessesProvider)
      .getBusinessByIdLoader.load(DbCharge.business_id);
    if (business?.suggestion_data) {
      const suggestionData = business.suggestion_data as SuggestionData;

      return {
        description: suggestionData.description,
        tags: await Promise.all(
          suggestionData.tags.map(tag =>
            UUID_REGEX.test(tag)
              ? injector.get(TagsProvider).getTagByIDLoader.load(tag)
              : injector.get(TagsProvider).getTagByNameLoader.load(tag),
          ),
        ).then(tags => tags.filter(Boolean) as IGetTagsByIDsResult[]),
      };
    }
  }

  if (DbCharge.business_array && DbCharge.business_array.length > 1) {
    const isKrakenIncluded = krakenBusinessId && DbCharge.business_array.includes(krakenBusinessId);
    const isEtherscanIncluded =
      etherScanBusinessId && DbCharge.business_array.includes(etherScanBusinessId);
    const isEtanaIncluded = etanaBusinessId && DbCharge.business_array.includes(etanaBusinessId);
    const isPoalimIncluded = poalimBusinessId && DbCharge.business_array.includes(poalimBusinessId);

    if (isKrakenIncluded && isEtherscanIncluded) {
      return {
        description: 'Etherscan to Kraken transfer',
        tags: await injector
          .get(TagsProvider)
          .getTagByNameLoader.load('financial')
          .then(res => (res ? [res] : [])),
      };
    }
    if (isKrakenIncluded && isEtanaIncluded) {
      return {
        description: 'Kraken to Etana transfer',
        tags: await injector
          .get(TagsProvider)
          .getTagByNameLoader.load('financial')
          .then(res => (res ? [res] : [])),
      };
    }
    if (isPoalimIncluded && isEtanaIncluded) {
      return {
        description: 'Etana to Poalim transfer',
        tags: await injector
          .get(TagsProvider)
          .getTagByNameLoader.load('financial')
          .then(res => (res ? [res] : [])),
      };
    }
  }

  const allBusinesses = await injector.get(BusinessesProvider).getAllBusinesses();
  const suggestions: Record<string, Suggestion> = {};
  for (const business of allBusinesses) {
    if (!business.suggestion_data) continue;
    const suggestionData = business.suggestion_data as SuggestionData;

    if (business.id in (DbCharge.business_array ?? [])) {
      return {
        description: suggestionData.description,
        tags: await Promise.all(
          suggestionData.tags.map(tag =>
            UUID_REGEX.test(tag)
              ? injector.get(TagsProvider).getTagByIDLoader.load(tag)
              : injector.get(TagsProvider).getTagByNameLoader.load(tag),
          ),
        ).then(tags => tags.filter(Boolean) as IGetTagsByIDsResult[]),
      };
    }

    if (!suggestionData.phrases) continue;

    for (const phrase of suggestionData.phrases) {
      suggestions[phrase] = {
        description: suggestionData.description,
        tags: suggestionData.tags
          ? await Promise.all(
              suggestionData.tags.map(tag =>
                UUID_REGEX.test(tag)
                  ? injector.get(TagsProvider).getTagByIDLoader.load(tag)
                  : injector.get(TagsProvider).getTagByNameLoader.load(tag),
              ),
            ).then(tags => tags.filter(Boolean) as IGetTagsByIDsResult[])
          : [],
      };
    }
  }

  const transactions = await injector
    .get(TransactionsProvider)
    .transactionsByChargeIDLoader.load(DbCharge.id);
  const description = transactions.map(t => t.source_description).join(' ');

  for (const [phrase, suggestion] of Object.entries(suggestions)) {
    if (Array.isArray(phrase) && new RegExp(phrase.join('|')).test(description)) {
      return suggestion;
    }
    if (description.includes(phrase)) {
      return suggestion;
    }
  }

  if (
    description.includes('ע\' העברת מט"ח') ||
    (description.includes('העברת מט"ח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    (description.includes('מטח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    description.includes('F.C.COM') ||
    description.includes('ע.מפעולות-ישיר') ||
    description.includes('ריבית חובה') ||
    description.includes('FEE')
  ) {
    const sourceTransaction =
      transactions.length === 0
        ? 'Missing'
        : transactions.length === 1
          ? transactions[0].source_reference
          : `['${transactions.map(t => t.source_reference).join("','")}']`;
    return {
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('financial')
        .then(res => (res ? [res] : [])),
      description: `Fees for source transaction=${sourceTransaction}`,
    };
  }
  if (description.includes('דותן שמחה') || description.includes('שמחה דותן')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `${previousMonth}/2022 Salary`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('גולדשטין אורי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `${previousMonth}/2022 Salary`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('גרדוש')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `${previousMonth}/2022 Salary`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('תובל')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `${previousMonth}/2022 Salary`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('מנורה מבטחים פנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `Pension ${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('פניקס אקסלנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `Training Fund ${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('מיטב דש גמל ופנס')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `Pension ${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('מגדל מקפת')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `Pension ${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('מגדל השתלמות')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `Training Fund ${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('ביטוח לאומי')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `Social Security Deductions for Salaries ${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('LANCE GLOBAL')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      description: `The Guild Enterprise Support - ${previousMonth} 2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (
    (description.includes('העברת מט"ח') &&
      (description.includes('fbv') || description.includes('fv'))) ||
    description.includes('kamil kisiela')
  ) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `Software Development and Consulting ${previousMonth}/23`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('slava')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      description: `Web Development Services ${previousMonth}/23`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('COURIER PLUS INC')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      description: `GraphQL Hive Enterprise License - ${previousMonth} 2023`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('GOBRANDS')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      description: `GraphQL Hive Enterprise License - ${previousMonth} 2023`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('MEDIC FIRST AI')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: 'long' });
    return {
      description: `GraphQL Hive Enterprise License - ${previousMonth} 2023`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('מס הכנסה')) {
    const flag = description.includes('מס הכנסה ני');
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
      description: flag
        ? `Tax for employees for ${previousMonth}/2022`
        : `Advance Tax for ${previousMonth}/2022`,
    };
  }
  if (description.includes('המכס ומעמ-גביי תשלום') || description.includes('CUSTOM + V.A.T')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', {
      month: '2-digit',
    });
    return {
      description: `VAT for ${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('חניון')) {
    return {
      description: 'Parking',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('transportation')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('deel')) {
    return {
      description: 'Laurin Salary',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('GITHUB')) {
    const suggested = {
      description: 'GitHub Actions',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
    if (formatAmount(DbCharge.event_amount) <= -2000) {
      suggested.description = 'Monthly Sponsor for Benjie, Code-Hex, hayes';
    } else if (formatAmount(DbCharge.event_amount) <= -1000) {
      suggested.description = 'Monthly Sponsor for Andarist, warrenday';
    } else {
      suggested.description = 'GitHub Actions';
    }
    return suggested;
  }
  if (formatAmount(DbCharge.event_amount) === -4329) {
    return {
      description: 'Office rent',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('APPLE COM BILL/ITUNES.COM')) {
    const flag = formatAmount(DbCharge.event_amount) === -109.9;
    return {
      taxCategory: 'אתר',
      beneficiaaries: [], // NOTE: used to be ' '
      description: flag ? 'LinkedIn' : 'Apple Services',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load(flag ? 'business' : 'computer')
        .then(res => (res ? [res] : [])),
    };
  }
  if (
    description.includes('ע\' העברת מט"ח') ||
    (description.includes('העברת מט"ח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    (description.includes('מטח') && Math.abs(formatAmount(DbCharge.event_amount)) < 400) ||
    description.includes('F.C.COM') ||
    description.includes('ע.מפעולות-ישיר') ||
    description.includes('ריבית חובה') ||
    description.includes('FEE')
  ) {
    const description = transactions.length
      ? `['${transactions.map(t => t.source_reference).join("','")}']`
      : 'Missing';
    //NOTE: multiple suggestions business
    return {
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('financial')
        .then(res => (res ? [res] : [])),
      description,
    };
  }
  if (description.includes('ריבית זכות')) {
    //NOTE: multiple suggestions business
    return {
      description: 'Interest fees on Euro plus',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('financial')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('פועלים- דמי כרטיס')) {
    //NOTE: multiple suggestions business
    return {
      description: 'Bank creditcard fees',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('financial')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('אריה קריסטל')) {
    //NOTE: multiple suggestions business
    return {
      description: 'Water bill for 04-2022',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('house')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('aleksandra')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      description: `Software Consulting Fees (${previousMonth}/2023)`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (description.includes('denelop')) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      description: `Software Development and Consulting ${previousMonth}/2023`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (formatAmount(DbCharge.event_amount) === -12_000) {
    const current = new Date();
    current.setMonth(current.getMonth() - 1);
    const previousMonth = current.toLocaleString('default', { month: '2-digit' });
    return {
      description: `${previousMonth}/2022`,
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }
  if (formatAmount(DbCharge.event_amount) === -600) {
    return {
      description: 'Matic Zavadlal - April 2021',
      tags: await injector
        .get(TagsProvider)
        .getTagByNameLoader.load('business')
        .then(res => (res ? [res] : [])),
    };
  }

  return null;
};

const commonChargeFields: ChargesModule.ChargeResolvers = {
  missingInfoSuggestions: missingInfoSuggestions as ChargeResolvers['missingInfoSuggestions'],
};

export const chargeSuggestionsResolvers: ChargesModule.Resolvers = {
  Query: {
    similarCharges: async (
      _,
      {
        chargeId,
        withMissingTags = false,
        withMissingDescription = false,
        descriptionDifferentThan,
        tagsDifferentThan,
      },
      { injector },
    ) => {
      if (!chargeId?.trim()) {
        throw new GraphQLError('Charge ID is required');
      }

      const mainCharge = await injector
        .get(ChargesProvider)
        .getChargeByIdLoader.load(chargeId)
        .catch(e => {
          console.error('Error fetching charge', { chargeId, error: e });
          throw new GraphQLError('Error fetching charge');
        });

      if (!mainCharge) {
        throw new GraphQLError(`Charge not found: ${chargeId}`);
      }

      const similarCharges = await injector
        .get(ChargesProvider)
        .getSimilarCharges({
          businessId: mainCharge.business_id,
          businessArray: mainCharge.business_array,
          withMissingTags,
          withMissingDescription,
          tagsDifferentThan: tagsDifferentThan ? [...tagsDifferentThan] : undefined,
          descriptionDifferentThan,
          ownerId: mainCharge.owner_id,
        })
        .catch(e => {
          console.error('Error fetching similar charges:', {
            chargeId,
            businessId: mainCharge.business_id,
            businessArray: mainCharge.business_array,
            error: e.message,
          });
          throw new GraphQLError('Error fetching similar charges');
        });
      return similarCharges;
    },
    similarChargesByBusiness: async (
      _,
      { businessId, ownerId: ownerIdInput, tagsDifferentThan, descriptionDifferentThan },
      { injector, adminContext },
    ) => {
      if (!businessId?.trim()) {
        throw new GraphQLError('Business ID is required');
      }

      const ownerId = ownerIdInput?.trim() || adminContext.defaultAdminBusinessId;

      const similarCharges = await injector
        .get(ChargesProvider)
        .getSimilarCharges({
          businessId,
          tagsDifferentThan: tagsDifferentThan ? [...tagsDifferentThan] : undefined,
          descriptionDifferentThan,
          ownerId,
        })
        .catch(e => {
          console.error('Error fetching similar charges:', {
            businessId,
            ownerId,
            error: e.message,
          });
          throw new GraphQLError('Error fetching similar charges by business');
        });
      return similarCharges;
    },
  },
  CommonCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
};
