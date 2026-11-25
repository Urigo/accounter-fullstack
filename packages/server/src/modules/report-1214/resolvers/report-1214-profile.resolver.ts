import { errorSimplifier } from '../../../shared/errors.js';
import { resolveReport1214Owner } from '../helpers/owner.helper.js';
import {
  amountOverridesToGql,
  bankAccountToGql,
  declarationsToGql,
  emptyToNull,
  mapReport1214ProfileRow,
  normalizeReport1214ProfileInput,
  relatedCompaniesToGql,
} from '../helpers/report-1214-profile.helper.js';
import { assertReport1214Year } from '../helpers/shareholders.helper.js';
import { Report1214ProfileProvider } from '../providers/report-1214-profile.provider.js';
import type { Report_1214Module } from '../types.js';

export const report1214ProfileResolvers: Report_1214Module.Resolvers = {
  Query: {
    report1214Profile: async (_, { ownerId: requestedOwnerId, year }, { injector }) => {
      try {
        assertReport1214Year(year);
        const ownerId = await resolveReport1214Owner(injector, requestedOwnerId, 'read');
        const row = await injector
          .get(Report1214ProfileProvider)
          .getProfileByOwnerAndYearLoader.load({ ownerId, year });
        return mapReport1214ProfileRow(row, ownerId, year);
      } catch (error) {
        throw errorSimplifier(`Failed to get the form 1214 profile of ${year}`, error);
      }
    },
  },
  Mutation: {
    updateReport1214Profile: async (
      _,
      { ownerId: requestedOwnerId, year, input },
      { injector },
    ) => {
      try {
        assertReport1214Year(year);
        const patch = normalizeReport1214ProfileInput(input, year);
        const ownerId = await resolveReport1214Owner(injector, requestedOwnerId, 'write');
        const row = await injector
          .get(Report1214ProfileProvider)
          .upsertProfile(ownerId, year, patch);
        return mapReport1214ProfileRow(row, ownerId, year);
      } catch (error) {
        throw errorSimplifier(`Failed to update the form 1214 profile of ${year}`, error);
      }
    },
  },
  Report1214Profile: {
    id: profile => `${profile.ownerId}:${profile.year}`,
    ownerId: profile => profile.ownerId,
    year: profile => profile.year,
    company: profile => profile.company,
    declarations: profile => declarationsToGql(profile.declarations),
    preparer: profile => emptyToNull(profile.preparer),
    attachments: profile => emptyToNull(profile.attachments),
    bankAccount: profile => bankAccountToGql(profile.bankAccount),
    otherTaxableIncome: profile => emptyToNull(profile.otherTaxableIncome),
    capitalGainsSummary: profile => emptyToNull(profile.capitalGainsSummary),
    qualifyingCompany: profile => emptyToNull(profile.qualifyingCompany),
    relatedCompanies: profile => relatedCompaniesToGql(profile.relatedCompanies),
    rdInvestments: profile => profile.rdInvestments,
    amountOverrides: profile => amountOverridesToGql(profile.amountOverrides),
    updatedAt: profile => profile.updatedAt,
  },
};
