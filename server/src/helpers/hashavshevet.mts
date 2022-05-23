import { format } from 'date-fns';

function date(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

function account(
    accountType: string,
    financialAccounts: any,
    hashBusinessIndexes: any,
    hashVATIndexes: any,
    currency: any,
    isracardHashIndexes: any,
    transactionDescription: any
  ): string | null {
    switch (accountType) {
      case 'checking_ils':
        return financialAccounts.hashavshevet_account_ils;
      case 'checking_usd':
        return financialAccounts.hashavshevet_account_usd;
      case 'checking_eur':
        return financialAccounts.hashavshevet_account_eur;
      case 'creditcard':
        switch (currency) {
          case 'ILS':
            return financialAccounts.hashavshevet_account_ils;
          case 'USD':
            return financialAccounts.hashavshevet_account_usd;
          case 'EUR':
            return financialAccounts.hashavshevet_account_eur;
          default: {}
            const errorMessage = `Unknown currency - ${currency}`;
            console.error(errorMessage);
            return errorMessage;
        }
      case 'Isracard':
        console.log('isracardHashIndexes', isracardHashIndexes);
        return isracardHashIndexes;
      // case 'Hot Mobile':
      //   return 'הוט';
      //   break;
      // case 'Dotan Simha':
      //   return 'דותן';
      //   break;
      // case 'MapMe':
      //   return 'מאפלאבס';
      //   break;
      // case 'Israeli Corporations Authority':
      //   return 'רשם החברות';
      //   break;
      // case 'SATURN AMSTERDAM ODE':
      //   return 'SATURN AMS';
      //   break;
      // case 'Linux Foundation':
      //   return 'LinuxFound';
      //   break;
      // case 'Malach':
      //   return 'מלאך';
      //   break;
      // case 'Spaans&Spaans':
      //   return 'Spaans';
      //   break;
      // case 'IMPACT HUB ATHENS':
      //   return 'IMPACT HUB ATHE';
      //   break;
      // case 'ENTERPRISE GRAPHQL Conference':
      //   return 'ENTERPRISE GRAP';
      //   break;
      // case 'Yaacov Matri':
      //   return 'יעקב';
      //   break;
      // case 'Uri Goldshtein':
      //   return 'אורי';
      //   break;
      // case 'Uri Goldshtein Hoz':
      //   return 'אוריח';
      //   break;
      // case 'Raveh Ravid & Co':
      //   return 'יהל';
      //   break;
      // case 'Production Ready GraphQL':
      //   return 'ProdReadyGraph';
      //   break;
      // case 'Tax Corona Grant':
      //   return 'מענק קורונה';
      //   break;
      // case 'VAT interest refund':
      //   return 'מעמ שער';
      //   break;
      // case 'Tax Shuma':
      //   return 'שומה 2018';
      //   break;
      // case 'Halman Aldubi Training Fund':
      //   return 'הלמןקהל';
      //   break;
      // case 'Halman Aldubi Pension':
      //   return 'הלמןפנסי';
      //   break;
      default:
        if (
          hashBusinessIndexes &&
          !Object.values(hashVATIndexes).includes(accountType) &&
          hashBusinessIndexes.auto_tax_category != accountType
        ) {
          if (transactionDescription == 'הפקדה לפקדון') {
            return 'פקדון';
            // return '4668039';
          } else if (hashBusinessIndexes.hash_index) {
            return hashBusinessIndexes.hash_index;
          } else {
            return accountType ? accountType.substring(0, 15).trimEnd() : null;
          }
        }
        return accountType ? accountType.substring(0, 15).trimEnd() : null;
    }
  }
  
  function number(rawNumber: any, options: {abs?: boolean} = {abs: false}): string | null {
    let parsed = Number.parseFloat(rawNumber);
    if (isNaN(parsed)) {
        return null;
    }
    if (options.abs) {
        parsed = Math.abs(parsed);
    }
    const formatted = parsed.toFixed(2);
    if (formatted == '0.00') {
        return null;
    }
    return formatted;
  }

export const hashavshevetFormat = {
  date,
  number,
  account,
};
