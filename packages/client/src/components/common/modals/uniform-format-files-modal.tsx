'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { endOfYear, format, setYear, startOfYear } from 'date-fns';
import { Calendar, Download, Loader2 } from 'lucide-react';
import { TimelessDateString } from 'packages/client/src/helpers/dates.js';
import { useQuery } from 'urql';
import { UniformFormatDocument } from '../../../gql/graphql.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FileDownloadModal() {
  const defaultFromDate = format(
    startOfYear(setYear(new Date(), -1)),
    'yyyy-MM-dd',
  ) as TimelessDateString;
  const defaultToDate = format(
    endOfYear(setYear(new Date(), -1)),
    'yyyy-MM-dd',
  ) as TimelessDateString;

  const [open, setOpen] = useState(false);
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
        const bkmvdataFile = new File([bkmvdata], `bkmvdata_${fromDate}_to_${toDate}.txt`, {
          type: 'text/plain',
        });
        const iniFile = new File([ini], `ini_${fromDate}_to_${toDate}.txt`, { type: 'text/plain' });

        // Download both files
        downloadFile(iniFile);
        setTimeout(() => downloadFile(bkmvdataFile), 100); // Small delay to avoid browser blocking

        // Close modal and reset form
        setOpen(false);
        setFromDate(defaultFromDate);
        setToDate(defaultToDate);
        setIsLoading(false);
      } else if (!uniformFormatResult.data?.uniformFormat) {
        setFormError('No data returned from the server. Please try again.');
        setIsLoading(false);
      }
    }
  }, [uniformFormatResult, isLoading, fromDate, toDate, defaultFromDate, defaultToDate]);

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
      setOpen(newOpen);
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
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          Generate Files
        </Button>
      </DialogTrigger>
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
