'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { endOfYear, format, startOfYear, subYears } from 'date-fns';
import iconv from 'iconv-lite';
import { Calendar, Download, Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { UniformFormatDocument } from '../../../gql/graphql.js';
import { downloadFile, type TimelessDateString } from '../../../helpers/index.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query UniformFormat($fromDate: TimelessDate!, $toDate: TimelessDate!) {
    uniformFormat(fromDate: $fromDate, toDate: $toDate) {
      bkmvdata
      ini
    }
  }
`;

export function UniformFormatFilesDownloadModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lastYear = subYears(new Date(), 1);
  const defaultFromDate = format(startOfYear(lastYear), 'yyyy-MM-dd') as TimelessDateString;
  const defaultToDate = format(endOfYear(lastYear), 'yyyy-MM-dd') as TimelessDateString;

  const [fromDate, setFromDate] = useState<TimelessDateString>(defaultFromDate);
  const [toDate, setToDate] = useState<TimelessDateString>(defaultToDate);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [uniformFormatResult, refetchUniformFormat] = useQuery({
    pause: true,
    query: UniformFormatDocument,
    variables: {
      fromDate,
      toDate,
    },
  });

  useEffect(() => {
    // Handle the query result when it changes
    if (isLoading && !uniformFormatResult.fetching) {
      if (uniformFormatResult.error) {
        setFormError('Failed to fetch uniform format data. Please try again.');
        console.error('GraphQL error:', uniformFormatResult.error);
        setIsLoading(false);
        return;
      }

      if (uniformFormatResult.data?.uniformFormat) {
        const { bkmvdata, ini } = uniformFormatResult.data.uniformFormat;

        if (!bkmvdata || !ini) {
          setFormError('Incomplete data received from the server. Please try again.');
          setIsLoading(false);
          return;
        }

        // Create files from the response data
        const bkmvdataFile = new File([iconv.encode(bkmvdata, 'ISO-8859-8')], 'bkmvdata.txt', {
          type: 'text/plain',
        });
        const iniFile = new File([iconv.encode(ini, 'ISO-8859-8')], 'ini.txt', {
          type: 'text/plain',
        });

        // Download both files
        downloadFile(iniFile);
        setTimeout(() => downloadFile(bkmvdataFile), 100); // Small delay to avoid browser blocking

        // Close modal and reset form
        onOpenChange(false);
        setFromDate(defaultFromDate);
        setToDate(defaultToDate);
        setIsLoading(false);
      } else if (uniformFormatResult.stale && !uniformFormatResult.data?.uniformFormat) {
        setFormError('No data returned from the server. Please try again.');
        setIsLoading(false);
      }
    }
  }, [
    uniformFormatResult,
    isLoading,
    fromDate,
    toDate,
    defaultFromDate,
    defaultToDate,
    onOpenChange,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fromDate || !toDate) {
      setFormError('Please select both from and to dates');
      return;
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (from >= to) {
      setFormError('From date must be before to date');
      return;
    }

    if (to > new Date()) {
      setFormError('To date cannot be in the future');
      return;
    }

    setIsLoading(true);

    try {
      // Trigger the query
      refetchUniformFormat({ requestPolicy: 'network-only' });
    } catch (err) {
      setFormError('Failed to generate files. Please try again.');
      console.error('Error generating files:', err);
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        // Reset form when closing
        setFromDate(defaultFromDate);
        setToDate(defaultToDate);
        setFormError('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Generate Uniform Files
          </DialogTitle>
          <DialogDescription>
            Select the date range to generate and download uniform files.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value as TimelessDateString)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value as TimelessDateString)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {formError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{formError}</div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate & Download
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
