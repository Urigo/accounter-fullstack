import { GraphQLError } from 'graphql';
import {
  generate1214,
  Opcn1214Error,
  supportedTaxYears,
  type GenerateResult,
} from '@accounter/opcn1214-generator';
import { errorSimplifier } from '../../../shared/errors.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { resolveReport1214Owner } from '../helpers/owner.helper.js';
import { buildReport1214Input } from '../helpers/report-1214-input.helper.js';
import { collectReport1214Issues, issueToGql } from '../helpers/report-1214-issues.helper.js';
import { mapReport1214ProfileRow } from '../helpers/report-1214-profile.helper.js';
import { assertReport1214Year, mapShareholderRow } from '../helpers/shareholders.helper.js';
import { Report1214ProfileProvider } from '../providers/report-1214-profile.provider.js';
import { ShareholdersProvider } from '../providers/shareholders.provider.js';
import type { Report_1214Module } from '../types.js';

function validationFailed(year: number): GraphQLError {
  return new GraphQLError(
    `The ${year} form 1214 report has validation errors; see the report validation`,
    { extensions: { code: 'REPORT_1214_VALIDATION_FAILED' } },
  );
}

/** Memoizes `fn`, so every field of one `Report1214` shares a single input build. */
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let result: Promise<T> | undefined;
  return () => (result ??= fn());
}

export const report1214Resolvers: Report_1214Module.Resolvers = {
  Query: {
    report1214: async (_, { ownerId: requestedOwnerId, year }, { injector }) => {
      try {
        assertReport1214Year(year);
        const ownerId = await resolveReport1214Owner(injector, requestedOwnerId, 'read');
        return {
          ownerId,
          year,
          // errors of the build reach both `validation` and `file` through this one wrapper
          build: once(() =>
            buildReport1214Input(injector, ownerId, year).catch(error => {
              throw errorSimplifier(`Failed to build the form 1214 report of ${year}`, error);
            }),
          ),
        };
      } catch (error) {
        throw errorSimplifier(`Failed to get the form 1214 report of ${year}`, error);
      }
    },
    report1214SupportedYears: () => [...supportedTaxYears()],
  },
  Report1214: {
    id: report => `${report.ownerId}:${report.year}`,
    owner: async (report, _, { injector }) => {
      const business = await injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(report.ownerId);
      if (!business) {
        throw new GraphQLError(`Report business not found (ID: ${report.ownerId})`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      return business;
    },
    year: report => report.year,
    profile: async (report, _, { injector }) => {
      const row = await injector
        .get(Report1214ProfileProvider)
        .getProfileByOwnerAndYearLoader.load({ ownerId: report.ownerId, year: report.year });
      return mapReport1214ProfileRow(row, report.ownerId, report.year);
    },
    shareholders: async (report, _, { injector }) => {
      const rows = await injector
        .get(ShareholdersProvider)
        .getShareholdersByOwnerAndYearLoader.load({ ownerId: report.ownerId, year: report.year });
      return rows.map(mapShareholderRow);
    },
    amounts: async report => (await report.build()).amounts,
    validation: async report => {
      const { errors, warnings } = collectReport1214Issues(await report.build());
      return {
        isValid: errors.length === 0,
        errors: errors.map(issueToGql),
        warnings: warnings.map(issueToGql),
      };
    },
    file: async report => {
      const { input, mappingIssues } = await report.build();
      if (!input || mappingIssues.some(issue => issue.severity === 'error')) {
        throw validationFailed(report.year);
      }
      let generated: GenerateResult;
      try {
        generated = generate1214(input);
      } catch (error) {
        if (error instanceof Opcn1214Error) {
          throw validationFailed(report.year);
        }
        throw error;
      }
      return {
        id: `${report.ownerId}:${report.year}:file`,
        fileName: generated.fileName,
        encodedContent: Buffer.from(generated.bytes).toString('base64'),
        warnings: [
          ...mappingIssues.filter(issue => issue.severity === 'warning'),
          ...generated.warnings,
        ].map(issueToGql),
        omittedZeroCodes: generated.summary.omittedZeroCodes.map(
          ({ record, recordIndex, code }) => ({ record, recordIndex, code }),
        ),
      };
    },
  },
};
