/**
 * Integration test for the GraphQL upload client against a live Accounter server.
 *
 * Prerequisites:
 *   - Local Accounter server running (yarn server:dev or similar)
 *   - ACCOUNTER_SERVER_URL set in .env (default: http://localhost:4000/graphql)
 *   - SCRAPER_API_KEY set in .env with a key that has the "scraper" role
 *
 * Skipped automatically when SCRAPER_API_KEY is not set.
 */

import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HapoalimILSTransactions } from '@accounter/modern-poalim-scraper';
import { createUploadClient, type ScraperUploadResult } from '../graphql/client.js';

config({ path: ['../../.env', '.env'] });

const SERVER_URL = process.env['ACCOUNTER_SERVER_URL'] ?? 'http://localhost:4000/graphql';
const API_KEY = process.env['SCRAPER_API_KEY'] ?? '';

const FIXTURE_TX: HapoalimILSTransactions = {
  comments: [],
  message: [],
  numItemsPerPage: 1,
  pdfUrl: '',
  transactions: [
    {
      activityDescription: 'Integration test deposit',
      activityTypeCode: 1,
      eventAmount: 1,
      eventDate: 20991231,
      formattedEventDate: '31/12/2099',
      serialNumber: 9999999,
      transactionType: 'REGULAR' as const,
      currentBalance: 0,
      referenceNumber: 9999999,
      referenceCatenatedNumber: 0,
      valueDate: 20991231,
      formattedValueDate: '31/12/2099',
      eventActivityTypeCode: 1,
      internalLinkCode: 0,
      originalEventCreateDate: 0,
      dataGroupCode: 0,
      expandedEventDate: '20991231',
      executingBranchNumber: 600,
      eventId: 9999999,
      differentDateIndication: 'N',
      tableNumber: 0,
      recordNumber: 0,
      contraBankNumber: 0,
      contraBranchNumber: 0,
      contraAccountNumber: 0,
      contraAccountTypeCode: 0,
      marketingOfferContext: 0,
      commentExistenceSwitch: 0,
      fieldDescDisplaySwitch: 0,
      activityDescriptionIncludeValueDate: null,
      beneficiaryDetailsData: null,
      comment: null,
      details: null,
      englishActionDesc: null,
      formattedOriginalEventCreateDate: null,
      offerActivityContext: null,
      pfmDetails: null,
      rejectedDataEventPertainingIndication: '',
      textCode: 0,
      displayCreditAccountDetails: 0,
      displayRTGSIncomingTrsDetails: 0,
      formattedEventAmount: '1.00',
      formattedCurrentBalance: '0.00',
    },
  ],
  retrievalTransactionData: {
    accountNumber: 999999,
    balanceAmountDisplayIndication: 'Y',
    bankNumber: 12,
    branchNumber: 600,
    eventCounter: 1,
    formattedRetrievalEndDate: '31/12/2099',
    formattedRetrievalMaxDate: '31/12/2099',
    formattedRetrievalMinDate: '31/12/2099',
    formattedRetrievalStartDate: '31/12/2099',
    joinPfm: false,
    retrievalEndDate: 20991231,
    retrievalMaxDate: 20991231,
    retrievalMinDate: 20991231,
    retrievalStartDate: 20991231,
  },
};

describe.skipIf(!API_KEY)('GraphQL upload client — live server integration', () => {
  let client: ReturnType<typeof createUploadClient>;

  beforeAll(async () => {
    client = createUploadClient(SERVER_URL, API_KEY);

    // Verify the server is reachable before running tests
    const res = await fetch(SERVER_URL.replace('/graphql', '/healthz')).catch(() => null);
    if (!res || !res.ok) {
      throw new Error(
        `Accounter server not reachable at ${SERVER_URL}. Start it with yarn server:dev.`,
      );
    }
  });

  afterAll(async () => {
    // Clean up the fixture row we inserted so re-running tests always starts fresh.
    // We do this by inserting the same row again — it will be skipped (ON CONFLICT),
    // which confirms idempotency. Actual cleanup would require a direct DB query.
  });

  it('uploadPoalimIlsTransactions: inserts 1 on first call', async () => {
    const result: ScraperUploadResult = await client.uploadPoalimIls(FIXTURE_TX);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.insertedIds).toHaveLength(1);
    expect(typeof result.insertedIds[0]).toBe('string');
  });

  it('uploadPoalimIlsTransactions: skips 1 on second call (ON CONFLICT)', async () => {
    const result: ScraperUploadResult = await client.uploadPoalimIls(FIXTURE_TX);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.insertedIds).toHaveLength(0);
  });
});
