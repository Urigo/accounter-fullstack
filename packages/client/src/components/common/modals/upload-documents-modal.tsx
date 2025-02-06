'use client';

import { useCallback, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUploadDocumentsFromGoogleDrive } from '../../../hooks/use-upload-documents-from-google-drive.js';
import { useUploadMultipleDocuments } from '../../../hooks/use-upload-multiple-documents.js';
import { Button } from '../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs.js';

const fileSizeLimit = 10 * 1024 * 1024; // 5MB

// Document Schema
export const DOCUMENT_SCHEMA = z
  .instanceof(File)
  .refine(
    file =>
      [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/svg+xml',
        'image/gif',
      ].includes(file.type),
    { message: 'Invalid document file type' },
  )
  .refine(file => file.size <= fileSizeLimit, {
    message: 'File size should not exceed 5MB',
  });

const FormSchema = z
  .object({
    googleDriveUrl: z
      .string()
      .url({ message: 'Invalid url' })
      .includes('drive.google.com', { message: 'Invalid url: origin must be "drive.google.com"' })
      .includes('/folders/', { message: 'Invalid url: is this a folder link?' })
      .optional(),
    documents: z.array(DOCUMENT_SCHEMA).optional(),
    method: z.enum(['local-files', 'google-drive']),
  })
  .superRefine((data, ctx) => {
    if (
      data.method === 'local-files' &&
      (data.documents === undefined || data.documents.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one document is required',
      });
    }
    if (data.method === 'google-drive' && data.googleDriveUrl === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The Google Drive URL is required',
      });
    }
  });

export function UploadDocumentsModal({
  open,
  onOpenChange,
  chargeId,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chargeId?: string;
  onChange?: () => void;
}) {
  const [tab, setTab] = useState<z.infer<typeof FormSchema>['method']>('local-files');
  const { uploading: googleDriveUploading, uploadDocumentsFromGoogleDrive } =
    useUploadDocumentsFromGoogleDrive();
  const { uploading: multipleFilesUploading, uploadMultipleDocuments } =
    useUploadMultipleDocuments();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  const onTabChange = (value: z.infer<typeof FormSchema>['method']) => {
    form.setValue('method', value);
    if (value === 'google-drive') {
      form.clearErrors('documents');
      form.setValue('documents', undefined);
    } else {
      form.clearErrors('googleDriveUrl');
      form.setValue('googleDriveUrl', undefined);
    }
    setTab(value);
  };

  const onSubmit = useCallback(
    async (data: z.infer<typeof FormSchema>) => {
      let uploadExecution: Promise<unknown> = Promise.resolve();
      switch (data.method) {
        case 'local-files':
          if (data.documents) {
            uploadExecution = uploadMultipleDocuments({
              documents: data.documents,
              chargeId,
            });
          } else {
            form.setError('documents', { message: 'At least one document is required' });
          }
          break;
        case 'google-drive':
          if (data.googleDriveUrl) {
            uploadExecution = uploadDocumentsFromGoogleDrive({
              sharedFolderUrl: data.googleDriveUrl,
              chargeId,
            });
          } else {
            form.setError('googleDriveUrl', { message: 'The Google Drive URL is required' });
          }
          break;
      }
      await uploadExecution.then(() => {
        onChange?.();
        onOpenChange(false);
      });
    },
    [
      chargeId,
      form,
      onChange,
      onOpenChange,
      uploadDocumentsFromGoogleDrive,
      uploadMultipleDocuments,
    ],
  );

  const uploading = useMemo(
    () => googleDriveUploading || multipleFilesUploading,
    [googleDriveUploading, multipleFilesUploading],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={event => event.stopPropagation()}
        className="overflow-scroll max-h-screen"
      >
        <ErrorBoundary fallback={<div>Error uploading files</div>}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Tabs
                value={tab}
                onValueChange={tab => onTabChange(tab as z.infer<typeof FormSchema>['method'])}
                className="my-4"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger disabled={uploading} value="local-files">
                    Local Files
                  </TabsTrigger>
                  <TabsTrigger disabled={uploading} value="google-drive">
                    Google Drive
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="local-files">
                  <Card>
                    <CardHeader>
                      <CardTitle>Local Files</CardTitle>
                      <CardDescription>Upload documents from your computer</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <FormField
                        control={form.control}
                        name="documents"
                        render={({ field: { value: _value, onChange, ...fieldProps } }) => (
                          <FormItem>
                            <FormLabel>Files</FormLabel>
                            <FormControl>
                              <Input
                                {...fieldProps}
                                required
                                type="file"
                                multiple
                                accept=".jpg, .jpeg, .gif, .png, .pdf"
                                onChange={event => {
                                  onChange(
                                    event.target.files ? Object.values(event.target.files) : null,
                                  );
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="google-drive">
                  <Card>
                    <CardHeader>
                      <CardTitle>Google Shared Folder</CardTitle>
                      <CardDescription>
                        Upload documents from Google Drive shared folder
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <FormField
                        control={form.control}
                        name="googleDriveUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                              <Input {...field} required placeholder="Folder URL" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <FormMessage />
                <Button disabled={uploading} type="submit">
                  Upload
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
