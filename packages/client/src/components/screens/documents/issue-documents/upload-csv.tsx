import { ChangeEvent, ReactElement, useCallback, useState } from 'react';
import { parse } from 'csv-parse';
import { Upload } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import z from 'zod';
import { Currency, GenerateDocumentInfo } from '../../../../gql/graphql.js';
import { TimelessDateString } from '../../../../helpers/dates.js';
import { Button } from '../../../ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../ui/dialog.js';
import { Input } from '../../../ui/input.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip.jsx';
import { IssueDocumentsVariables } from './issue-documents-table.js';

type Props = {
  form: UseFormReturn<IssueDocumentsVariables, unknown, IssueDocumentsVariables>;
};

export const UploadCsv = ({ form }: Props): ReactElement => {
  const [open, setOpen] = useState(false);

  const onFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const issueMonth = getDateFromFile(file);

        let generateDocumentsInfo: GenerateDocumentInfo[] = [];
        try {
          generateDocumentsInfo = await getFileContent(file);
        } catch (error) {
          console.error('Error parsing file:', error);
          toast.error('Error', {
            description: 'Error parsing file',
            duration: 4000,
            closeButton: true,
          });
        }

        if (generateDocumentsInfo.length === 0) {
          toast.error('Error', {
            description: 'No records found in file',
            duration: 4000,
            closeButton: true,
          });
        } else {
          form.setValue('issueMonth', issueMonth);
          form.setValue('generateDocumentsInfo', generateDocumentsInfo);
          toast.success('Success', {
            description: 'CSV draft uploaded successfully',
            duration: 4000,
            closeButton: true,
          });
        }

        setOpen(false);
      }
    },
    [form],
  );

  return (
    <Tooltip>
      <TooltipTrigger>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="p-2">
              <Upload size={20} />
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[400px] max-w-screen-md">
            <DialogHeader>
              <DialogTitle>Upload documents generation draft</DialogTitle>
            </DialogHeader>
            <Input
              id="documentsGenerationCsvDraft"
              type="file"
              accept=".csv"
              onChange={onFileChange}
            />
          </DialogContent>
        </Dialog>
      </TooltipTrigger>
      <TooltipContent>
        <p>Upload CSV draft</p>
      </TooltipContent>
    </Tooltip>
  );
};

function getDateFromFile(file: File): TimelessDateString | undefined {
  const fileName = file.name;
  const dateMatch = fileName.match(/_(\d{4}_\d{2})/);
  if (dateMatch) {
    return `${dateMatch[1].replace(/_/g, '-')}-15` as TimelessDateString;
  }
  return undefined;
}

async function getFileContent(file: File): Promise<GenerateDocumentInfo[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const fileContent = e.target?.result;
      if (!fileContent) {
        return reject(new Error('No content found in file'));
      }

      const content = fileContent.toString();

      // parse CSV content
      const parser = parse(content, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
      });

      const generateDocumentsInfo: IssueDocumentsVariables['generateDocumentsInfo'] = [];

      parser.on('readable', () => {
        let record: string[];
        while ((record = parser.read()) !== null) {
          // ignore header
          if (!record || record[0] === 'tid') {
            continue;
          }

          try {
            const parsedRecord = parseDocumentInfo(record);
            generateDocumentsInfo.push(parsedRecord);
          } catch (error) {
            reject(error);
          }
        }
      });
      parser.on('error', reject);
      parser.on('end', () => {
        resolve(generateDocumentsInfo);
      });
    };
    reader.readAsText(file);
  });
}

const documentInfoSchema = z
  .object({
    amount: z
      .object({
        raw: z.number(),
        currency: z.nativeEnum(Currency),
      })
      .strict(),
    businessId: z.string().uuid(),
  })
  .strict();

function parseDocumentInfo(record: string[]) {
  if (record.length !== 4) {
    throw new Error('Invalid record length');
  }
  const parseResult = documentInfoSchema.safeParse({
    amount: {
      raw: parseFloat(record[2]),
      currency: record[3],
    },
    businessId: record[0],
  });
  if (!parseResult.success) {
    throw new Error(`Invalid record: ${JSON.stringify(parseResult.error.format())}`);
  }
  return parseResult.data;
}
