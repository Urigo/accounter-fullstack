import YAML from 'yaml';
import {
  AccountConfig,
  AmexAccountConfig,
  CalAccountConfig,
  createEmptyAccount,
  DiscountAccountConfig,
  HapoalimAccountConfig,
  IsracardAccountConfig,
  MaxAccountConfig,
  ScraperConfig,
} from './types';

// YAML interface for generic account
interface YamlAccount {
  source: string;
  nickname: string;
  password: string;
  // Hapoalim specific
  userCode?: string;
  // Discount specific
  idNumber?: string;
  code?: string;
  // Isracard/Amex specific
  last6Digits?: string;
  // CAL specific
  username?: string;
  fourDigits?: string;
  // Bank shared
  isBusinessAccount?: boolean;
  accountsToInclude?: string[];
  accountsToExclude?: string[];
  branchNumbersToInclude?: string[];
  branchNumbersToExclude?: string[];
  // Credit card shared
  cardNumbersToInclude?: string[];
  cardNumbersToExclude?: string[];
  // Isracard specific
  monthsToScrape?: number;
}

interface YamlConfig {
  serverUrl: string;
  accounts: YamlAccount[];
}

export function configToYaml(config: ScraperConfig): string {
  const yamlConfig: YamlConfig = {
    serverUrl: config.serverUrl,
    accounts: config.accounts.map(account => {
      const base: YamlAccount = {
        source: account.sourceId,
        nickname: account.nickname,
        password: account.password,
      };

      switch (account.sourceId) {
        case 'hapoalim': {
          const acc = account as HapoalimAccountConfig;
          return {
            ...base,
            userCode: acc.userCode,
            isBusinessAccount: acc.isBusinessAccount,
            accountsToInclude: acc.accountsToInclude,
            accountsToExclude: acc.accountsToExclude,
            branchNumbersToInclude: acc.branchNumbersToInclude,
            branchNumbersToExclude: acc.branchNumbersToExclude,
          };
        }
        case 'discount': {
          const acc = account as DiscountAccountConfig;
          return {
            ...base,
            idNumber: acc.idNumber,
            code: acc.code,
            isBusinessAccount: acc.isBusinessAccount,
            accountsToInclude: acc.accountsToInclude,
            accountsToExclude: acc.accountsToExclude,
            branchNumbersToInclude: acc.branchNumbersToInclude,
            branchNumbersToExclude: acc.branchNumbersToExclude,
          };
        }
        case 'isracard': {
          const acc = account as IsracardAccountConfig;
          return {
            ...base,
            idNumber: acc.idNumber,
            last6Digits: acc.last6Digits,
            monthsToScrape: acc.monthsToScrape,
            cardNumbersToInclude: acc.cardNumbersToInclude,
            cardNumbersToExclude: acc.cardNumbersToExclude,
          };
        }
        case 'amex': {
          const acc = account as AmexAccountConfig;
          return {
            ...base,
            idNumber: acc.idNumber,
            last6Digits: acc.last6Digits,
            cardNumbersToInclude: acc.cardNumbersToInclude,
            cardNumbersToExclude: acc.cardNumbersToExclude,
          };
        }
        case 'cal': {
          const acc = account as CalAccountConfig;
          return {
            ...base,
            username: acc.username,
            fourDigits: acc.fourDigits,
            cardNumbersToInclude: acc.cardNumbersToInclude,
            cardNumbersToExclude: acc.cardNumbersToExclude,
          };
        }
        case 'max': {
          const acc = account as MaxAccountConfig;
          return {
            ...base,
            username: acc.username,
            cardNumbersToInclude: acc.cardNumbersToInclude,
            cardNumbersToExclude: acc.cardNumbersToExclude,
          };
        }
        default:
          return base;
      }
    }),
  };

  return YAML.stringify(yamlConfig, { lineWidth: 0 });
}

export function yamlToConfig(yamlString: string): ScraperConfig {
  const yamlConfig = YAML.parse(yamlString) as YamlConfig;

  const accounts: AccountConfig[] = yamlConfig.accounts.map(yamlAccount => {
    const baseAccount = createEmptyAccount(yamlAccount.source);

    // Copy common fields
    baseAccount.nickname = yamlAccount.nickname || '';
    baseAccount.password = yamlAccount.password || '';

    switch (yamlAccount.source) {
      case 'hapoalim': {
        const acc = baseAccount as HapoalimAccountConfig;
        acc.userCode = yamlAccount.userCode || '';
        acc.isBusinessAccount = yamlAccount.isBusinessAccount || false;
        acc.accountsToInclude = yamlAccount.accountsToInclude || [];
        acc.accountsToExclude = yamlAccount.accountsToExclude || [];
        acc.branchNumbersToInclude = yamlAccount.branchNumbersToInclude || [];
        acc.branchNumbersToExclude = yamlAccount.branchNumbersToExclude || [];
        return acc;
      }
      case 'discount': {
        const acc = baseAccount as DiscountAccountConfig;
        acc.idNumber = yamlAccount.idNumber || '';
        acc.code = yamlAccount.code || '';
        acc.isBusinessAccount = yamlAccount.isBusinessAccount || false;
        acc.accountsToInclude = yamlAccount.accountsToInclude || [];
        acc.accountsToExclude = yamlAccount.accountsToExclude || [];
        acc.branchNumbersToInclude = yamlAccount.branchNumbersToInclude || [];
        acc.branchNumbersToExclude = yamlAccount.branchNumbersToExclude || [];
        return acc;
      }
      case 'isracard': {
        const acc = baseAccount as IsracardAccountConfig;
        acc.idNumber = yamlAccount.idNumber || '';
        acc.last6Digits = yamlAccount.last6Digits || '';
        acc.monthsToScrape = yamlAccount.monthsToScrape || 3;
        acc.cardNumbersToInclude = yamlAccount.cardNumbersToInclude || [];
        acc.cardNumbersToExclude = yamlAccount.cardNumbersToExclude || [];
        return acc;
      }
      case 'amex': {
        const acc = baseAccount as AmexAccountConfig;
        acc.idNumber = yamlAccount.idNumber || '';
        acc.last6Digits = yamlAccount.last6Digits || '';
        acc.cardNumbersToInclude = yamlAccount.cardNumbersToInclude || [];
        acc.cardNumbersToExclude = yamlAccount.cardNumbersToExclude || [];
        return acc;
      }
      case 'cal': {
        const acc = baseAccount as CalAccountConfig;
        acc.username = yamlAccount.username || '';
        acc.fourDigits = yamlAccount.fourDigits || '';
        acc.cardNumbersToInclude = yamlAccount.cardNumbersToInclude || [];
        acc.cardNumbersToExclude = yamlAccount.cardNumbersToExclude || [];
        return acc;
      }
      case 'max': {
        const acc = baseAccount as MaxAccountConfig;
        acc.username = yamlAccount.username || '';
        acc.cardNumbersToInclude = yamlAccount.cardNumbersToInclude || [];
        acc.cardNumbersToExclude = yamlAccount.cardNumbersToExclude || [];
        return acc;
      }
      default:
        return baseAccount;
    }
  });

  return {
    serverUrl: yamlConfig.serverUrl || '',
    accounts,
  };
}

export function downloadYaml(
  config: ScraperConfig,
  filename: string = 'scraper-config.yaml',
): void {
  const yaml = configToYaml(config);
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
