'use client';

import type React from 'react';
import { useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { DocumentType } from '../../../../gql/graphql.js';
import { getDocumentNameFromType } from '../../../../helpers/index.js';
import { Button } from '../../../ui/button.js';
import { Checkbox } from '../../../ui/checkbox.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog.js';
import { Label } from '../../../ui/label.js';
import { Textarea } from '../../../ui/textarea.js';

export interface IssueDocumentData {
  emailContent: string;
  attachment: boolean;
  sendEmail: boolean;
}

interface IssueDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssue: (issueData: IssueDocumentData) => Promise<void>;
  clientName?: string;
  clientEmails?: string[];
  documentType?: DocumentType;
}

export function IssueDocumentModal({
  isOpen,
  onClose,
  onIssue,
  clientName,
  clientEmails = [],
  documentType = DocumentType.Unprocessed,
}: IssueDocumentModalProps) {
  const [issueData, setIssueData] = useState<IssueDocumentData>({
    emailContent: '',
    attachment: true,
    sendEmail: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateIssueData = <T extends keyof IssueDocumentData>(
    field: T,
    value: IssueDocumentData[T],
  ) => {
    setIssueData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onIssue(issueData);
      onClose();
      // Reset form after successful submission
      setIssueData({
        emailContent: '',
        attachment: true,
        sendEmail: false,
      });
    } catch (error) {
      console.error('Failed to issue document:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Issue Document
          </DialogTitle>
          <DialogDescription>
            Configure email settings before sending the {getDocumentNameFromType(documentType)} to
            the client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Send Email Switch */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sendEmail"
              checked={issueData.sendEmail}
              onCheckedChange={checked => updateIssueData('sendEmail', checked === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="sendEmail" className="text-sm font-medium">
              Send email to client
            </Label>
          </div>
          <div className="text-xs text-gray-500 ml-6">
            When disabled, email will not be sent to the client.
          </div>

          {/* Client Information Display */}
          {clientName && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-700">Sending to:</div>
              <div className="text-sm text-gray-900">{clientName}</div>
              {clientEmails.length > 0 && (
                <div className="text-xs text-gray-600 mt-1">{clientEmails.join(', ')}</div>
              )}
            </div>
          )}

          {/* Email Content */}
          <div className="space-y-2">
            <Label htmlFor="emailContent">Email Message</Label>
            <Textarea
              id="emailContent"
              value={issueData.emailContent}
              onChange={e => updateIssueData('emailContent', e.target.value)}
              placeholder="Add a custom message to include in the email (optional)"
              className="min-h-[100px]"
              disabled={isSubmitting || !issueData.sendEmail}
            />
            <div className="text-xs text-gray-500">
              This message will be included in the email sent to the client along with the document.
            </div>
          </div>

          {/* Attachment Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="attachment"
              checked={issueData.attachment}
              onCheckedChange={checked => updateIssueData('attachment', checked === true)}
              disabled={isSubmitting || !issueData.sendEmail}
            />
            <Label htmlFor="attachment" className="text-sm font-medium">
              Attach document to email
            </Label>
          </div>
          <div className="text-xs text-gray-500 ml-6">
            When enabled, the PDF document will be attached to the email sent to the client.
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Issue Document
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
