import { validate1214 } from '../../src/index.js';
import type { Report1214Input } from '../../src/model/input.js';
import {
  forcedVirtualCurrencyAppendix,
  improvements,
  minimalInput,
  otherTransactionsAppendix,
  section6Appendix,
} from '../fixtures/builders.js';

const OPTIONS = { today: () => '2024-06-30' };

/** The [ruleId, path, recordType, recordIndex] of every issue of `input` (errors and warnings). */
function issuesOf(input: Report1214Input) {
  const { errors, warnings } = validate1214(input, OPTIONS);
  return [...errors, ...warnings].map(issue => [
    issue.ruleId,
    issue.path,
    issue.recordType,
    issue.recordIndex,
  ]);
}

describe('cg.improvements.code50Amount (SPEC §10.6)', () => {
  it('warns about an improvement without code50Amount, at the improvement', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            section6Appendix(),
            otherTransactionsAppendix({
              improvements: [{ date: '2015-01-01' }, improvements(2)[1]!, { date: '2016-01-01' }],
            }),
          ],
        }),
      ),
    ).toEqual([
      ['cg.improvements.code50Amount', 'capitalGains[1].improvements[0].code50Amount', '3077', 0],
      ['cg.improvements.code50Amount', 'capitalGains[1].improvements[2].code50Amount', '3077', 0],
    ]);
  });

  it('counts a code50Amount of 0 as absent (code 50x is not zeroAllowed)', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix({
              improvements: [{ expense: 1, date: '2015-01-01', code50Amount: 0 }],
            }),
          ],
        }),
      ),
    ).toEqual([
      ['cg.improvements.code50Amount', 'capitalGains[0].improvements[0].code50Amount', '3077', 0],
    ]);
  });

  it('warns about a code50Amount with neither expense nor accumulated depreciation', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix(),
            otherTransactionsAppendix({
              improvements: [
                { date: '2015-01-01', code50Amount: 100 },
                { accumulatedDepreciation: 5, date: '2016-01-01', code50Amount: 100 },
                { expense: 5, date: '2017-01-01', code50Amount: 100 },
              ],
            }),
          ],
        }),
      ),
    ).toEqual([
      ['cg.improvements.code50Amount', 'capitalGains[1].improvements[0].code50Amount', '3077', 1],
    ]);
  });

  it('raises nothing for complete improvements or none', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix({ improvements: improvements(5) }),
            otherTransactionsAppendix({ improvements: undefined }),
            otherTransactionsAppendix({ improvements: [] }),
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe('cg.virtualCurrency.wallet (SPEC §10.6)', () => {
  it('requires a wallet address in a 3077 with code 071 = 1', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix(),
            otherTransactionsAppendix({ walletAddresses: undefined }),
          ],
        }),
      ),
    ).toEqual([['cg.virtualCurrency.wallet', 'capitalGains[1].walletAddresses', '3077', 1]]);
  });

  it('counts a blank address as no address, and accepts one in the second slot only', () => {
    expect(
      issuesOf(
        minimalInput({
          capitalGains: [
            otherTransactionsAppendix({ walletAddresses: [' '] }),
            otherTransactionsAppendix({ walletAddresses: ['', '0x2'] }),
          ],
        }),
      ),
    ).toEqual([['cg.virtualCurrency.wallet', 'capitalGains[0].walletAddresses', '3077', 0]]);
  });

  it('requires nothing without code 071 or in a 3051 appendix', () => {
    const { walletAddresses: _walletAddresses, ...withoutWallet } = otherTransactionsAppendix({
      amounts: { '071': undefined },
    });
    const { walletAddresses: _forced, ...forcedWithoutWallet } = forcedVirtualCurrencyAppendix();
    expect(issuesOf(minimalInput({ capitalGains: [withoutWallet, forcedWithoutWallet] }))).toEqual(
      [],
    );
  });
});
