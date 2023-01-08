import { fetch } from './fetch.js';
import { ensureEnv } from './utils.js';

type EtherscanResponse<T> =
  | {
      status: '1';
      message: 'OK';
      result: T;
    }
  | {
      status: '0';
      message: 'NOTOK';
      result: 'string';
    };

type NumericString = `${number}`;
type HexString = `0x${string}`;

type ERC20Transaction = {
  blockNumber: NumericString;
  timeStamp: NumericString;
  hash: HexString;
  nonce: NumericString;
  blockHash: HexString;
  from: HexString;
  contractAddress: HexString;
  to: HexString;
  value: NumericString;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: NumericString;
  transactionIndex: NumericString;
  gas: NumericString;
  gasPrice: NumericString;
  gasUsed: NumericString;
  cumulativeGasUsed: NumericString;
  input?: 'deprecated';
  confirmations: NumericString;
};

export function errorOrResponse<T>(input: EtherscanResponse<T>): T {
  if (input.status === '0') {
    throw new Error(input.message);
  }

  return input.result;
}

function normalizeTx(wallet: string, tx: ERC20Transaction) {
  const decimals = parseInt(tx.tokenDecimal);
  const rawValue = parseInt(tx.value);
  const tokenAmount = rawValue / 10 ** decimals;

  return {
    id: `${wallet}-${tx.hash}`,
    date: new Date(parseInt(tx.timeStamp) * 1000),
    tokenAmount,
    currency: tx.tokenSymbol,
    raw: tx,
  };
}

export type NormalizedEtherscanTransaction = ReturnType<typeof normalizeTx>;

export function createEtherscan(options: { apiKey: string }) {
  const etherscanApiBaseUrl = ensureEnv('ETHERSCAN_API_BASE_URL', 'https://api.etherscan.io/api');

  return {
    listTokensTransactionsForWallet: async (wallet: string, contract: string) => {
      return await fetch<EtherscanResponse<ERC20Transaction[]>>(
        `${etherscanApiBaseUrl}?module=account&action=tokentx&contractaddress=${contract}&address=${wallet}&startblock=0&endblock=99999999&sort=desc&apikey=${options.apiKey}`,
      )
        .then(t => errorOrResponse(t))
        // Transactions with value "0" are not relevant, and we can treat is a dummy value
        .then(r => r.filter(t => t.value !== '0'))
        .then(r => r.map(tx => normalizeTx(wallet, tx)));
    },
  };
}

export type Etherscan = ReturnType<typeof createEtherscan>;
