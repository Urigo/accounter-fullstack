import { ReactElement, useCallback } from 'react';
import { format } from 'date-fns';
import { UseFormReturn } from 'react-hook-form';
import { AllClientsQuery } from '../../../../gql/graphql.js';
import { DownloadCSVButton } from '../../../common/index.js';
import { IssueDocumentsVariables } from './issue-documents-table.js';

type Props = {
  businessesData: AllClientsQuery['allClients'];
  form: UseFormReturn<IssueDocumentsVariables, unknown, IssueDocumentsVariables>;
};

export const DownloadCSV = ({ businessesData, form }: Props): ReactElement => {
  const createFileVariables = useCallback(async () => {
    const { issueMonth, generateDocumentsInfo } = form.getValues();

    // file name
    const issueMonthText = issueMonth
      ? issueMonth.substring(0, 7).replace(/-/g, '_')
      : format(new Date(), 'yyyy_MM');
    const fileName = `documents_generation_${issueMonthText}`;

    // content
    const content = generateDocumentsInfo
      .map(docInfo => {
        const businessName =
          businessesData.find(b => b.originalBusiness.id === docInfo.businessId)?.originalBusiness
            .name ?? '';
        return `"${sanitizeCsvContent(docInfo.businessId)}","${sanitizeCsvContent(businessName)}","${sanitizeCsvContent(
          docInfo.amount.raw,
        )}","${sanitizeCsvContent(docInfo.amount.currency)}"`;
      })
      .join('\r\n');

    return { fileContent: content, fileName };
  }, [form, businessesData]);

  return <DownloadCSVButton createFileVariables={createFileVariables} label="Save draft as CSV" />;
};

function sanitizeCsvContent(content: string | number): string | number {
  if (content === '') {
    return '';
  }
  if (!Number.isNaN(Number(content))) {
    return Number(content).toFixed(2);
  }
  const cleanContent = (content as string).replace(/"/g, '""').replace(/,/g, '.');
  return cleanContent;
}
