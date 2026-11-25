import { GraphQLError } from 'graphql';
import {
  generate1214,
  Opcn1214Error,
  supportedTaxYears,
  validate1214,
  type GenerateResult,
} from '@accounter/opcn1214-generator';
import type { Report1214Issue } from '../../../__generated__/types.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { resolveReport1214Owner } from '../helpers/owner.helper.js';
import { buildReport1214Input } from '../helpers/report-1214-input.helper.js';
import { mapReport1214ProfileRow } from '../helpers/report-1214-profile.helper.js';
import { assertReport1214Year, mapShareholderRow } from '../helpers/shareholders.helper.js';
import { Report1214ProfileProvider } from '../providers/report-1214-profile.provider.js';
import { ShareholdersProvider } from '../providers/shareholders.provider.js';
import type { Report_1214Module, Report1214BuildResult, Report1214IssueProto } from '../types.js';

/** A generator `Issue` or a mapping issue → GraphQL `Report1214Issue`. */
export function issueToGql(issue: Report1214IssueProto): Report1214Issue {
  return {
    ruleId: issue.ruleId,
    severity: issue.severity === 'error' ? 'ERROR' : 'WARNING',
    message: issue.message,
    path: issue.path || null,
    code: issue.code ?? null,
    recordType: issue.recordType ?? null,
    specRef: issue.specRef
      ? `p.${issue.specRef.page}${issue.specRef.note ? `: ${issue.specRef.note}` : ''}`
      : null,
  };
}

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

/** Mapping issues plus the generator's validation of the built input (skipped when there is none). */
function validateBuild({ input, mappingIssues }: Report1214BuildResult) {
  const result = input ? validate1214(input) : { errors: [], warnings: [] };
  const errors = [...mappingIssues.filter(issue => issue.severity === 'error'), ...result.errors];
  const warnings = [
    ...mappingIssues.filter(issue => issue.severity === 'warning'),
    ...result.warnings,
  ];
  return { errors, warnings };
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
          build: once(() => buildReport1214Input(injector, ownerId, year)),
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
        throw new GraphQLError(`Report business not found (ID: ${report.ownerId})`);
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
    validation: async report => {
      const { errors, warnings } = validateBuild(await report.build());
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
          ({ record, code }) => `${record}:${code}`,
        ),
      };
    },
  },
};
