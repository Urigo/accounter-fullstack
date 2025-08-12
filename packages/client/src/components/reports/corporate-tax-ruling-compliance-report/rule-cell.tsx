import type { ReactElement } from 'react';
import { getFragmentData, type FragmentType } from '../../../gql/fragment-masking.js';
import { CorporateTaxRulingReportRuleCellFieldsFragmentDoc } from '../../../gql/graphql.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment CorporateTaxRulingReportRuleCellFields on CorporateTaxRule {
    id
    rule
    percentage {
      formatted
    }
    isCompliant
  }
`;

type Props = {
  originalRuleData: FragmentType<typeof CorporateTaxRulingReportRuleCellFieldsFragmentDoc>;
  diffRuleData?: FragmentType<typeof CorporateTaxRulingReportRuleCellFieldsFragmentDoc>;
};

export const RuleCell = ({ originalRuleData, diffRuleData }: Props): ReactElement => {
  const originalRule = getFragmentData(
    CorporateTaxRulingReportRuleCellFieldsFragmentDoc,
    originalRuleData,
  );
  const diffRule = getFragmentData(CorporateTaxRulingReportRuleCellFieldsFragmentDoc, diffRuleData);
  const isDiff =
    diffRule?.isCompliant !== originalRule.isCompliant ||
    diffRule?.percentage.formatted !== originalRule.percentage.formatted;

  if (!diffRule || !isDiff) {
    return (
      <td className={originalRule.isCompliant ? 'text-green-500' : 'text-red-500'}>
        {originalRule.percentage.formatted}
      </td>
    );
  }

  return (
    <td className={originalRule.isCompliant ? 'text-green-500' : 'text-red-500'}>
      <div className="flex flex-col">
        <p
          className={'line-through '.concat(
            originalRule.isCompliant ? 'text-green-500' : 'text-red-500',
          )}
        >
          {originalRule.percentage.formatted}
        </p>
        {diffRule && (
          <div
            className={'border-2 border-yellow-500 rounded-md '.concat(
              diffRule.isCompliant ? 'text-green-500' : 'text-red-500',
            )}
          >
            {diffRule.percentage.formatted}
          </div>
        )}
      </div>
    </td>
  );
};
