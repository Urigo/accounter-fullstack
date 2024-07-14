import {
  adjustGetAccountsInputToRaw,
  adjustGetBankPageRecordsInputToRaw,
  adjustGetBatchInputToRaw,
  adjustGetRecordsInputToRaw,
  adjustGetTransactionsInputToRaw,
  sortCodesDataFile,
} from '../helpers/index.js';
import type {
  Account,
  BankPageRecord,
  Batch,
  RecordType,
  Resolvers,
  SortCode,
  Transaction,
} from '../mesh-artifacts/index.js';

const resolvers: Resolvers = {
  Query: {
    getSortCodes: async (root, _, context, info) => {
      const args = {
        input: {
          datafile: sortCodesDataFile,
          parameters: [],
        },
      };
      return context.Hashavshevet.Query.getSortCodesRaw({ root, context, info, args }).then(
        res => (res?.status.repdata?.filter(sortCode => !!sortCode) as SortCode[]) ?? [],
      );
    },
    getAccounts: async (root, args, context, info) => {
      const adjustedArgs = {
        input: adjustGetAccountsInputToRaw(args),
      };
      return context.Hashavshevet.Query.getAccountsRaw({
        root,
        context,
        info,
        args: adjustedArgs,
      }).then(res => (res?.status.repdata?.filter(account => !!account) as Account[]) ?? []);
    },
    getRecords: async (root, args, context, info) => {
      const adjustedArgs = {
        input: adjustGetRecordsInputToRaw(args),
      };
      return context.Hashavshevet.Query.getRecordsRaw({
        root,
        context,
        info,
        args: adjustedArgs,
      }).then(res => (res?.status.repdata?.filter(record => !!record) as RecordType[]) ?? []);
    },
    getTransactions: async (root, args, context, info) => {
      const adjustedArgs = {
        input: adjustGetTransactionsInputToRaw(args),
      };
      return context.Hashavshevet.Query.getTransactionsRaw({
        root,
        context,
        info,
        args: adjustedArgs,
      }).then(
        res => (res?.status.repdata?.filter(transaction => !!transaction) as Transaction[]) ?? [],
      );
    },
    getBatch: async (root, args, context, info) => {
      const adjustedArgs = {
        input: adjustGetBatchInputToRaw(args),
      };
      return context.Hashavshevet.Query.getBatchRaw({
        root,
        context,
        info,
        args: adjustedArgs,
      }).then(res => (res?.status.repdata?.[0] as Batch) ?? null);
    },
    getBankPageRecords: async (root, args, context, info) => {
      const adjustedArgs = {
        input: adjustGetBankPageRecordsInputToRaw(args),
      };
      return context.Hashavshevet.Query.getBankPageRecordsRaw({
        root,
        context,
        info,
        args: adjustedArgs,
      }).then(
        res =>
          (res?.status.repdata?.filter(BankPageRecord => !!BankPageRecord) as BankPageRecord[]) ??
          [],
      );
    },
  },
  Mutation: {
    importAccounts: async (root, args, context, info) => {
      const adjustedArgs = {
        ...args,
        myindex: 'acc',
      };
      return context.Hashavshevet.Mutation.importAccountsRaw({
        root,
        context,
        info,
        args: adjustedArgs,
      });
    },
  },
  RecordType: {
    batch: {
      selectionSet: `{
        batchId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.batchId) {
          return null;
        }
        return context.Hashavshevet.Query.getBatchRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'batch')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetBatchInputToRaw({
              idMin: root.batchId,
              idMax: root.batchId,
            }),
          },
        }).then(res => {
          return res?.status?.repdata?.[0] ?? null;
        });
      },
    },
    transaction: {
      selectionSet: `{
        transactionId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.transactionId) {
          return null;
        }
        return context.Hashavshevet.Query.getTransactionsRaw({
          root,
          context,
          info,
          key: root.transactionId,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'transaction')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          argsFromKeys: transactionIds => ({
            input: adjustGetTransactionsInputToRaw({
              idMin: Math.min.apply(null, transactionIds),
              idMax: Math.max.apply(null, transactionIds),
            }),
          }),
          valuesFromResults: (transactionsList, transactionIds) =>
            transactionIds.map(transactionId => {
              return (
                transactionsList?.status?.repdata?.find(
                  transaction => transaction?.id === transactionId,
                ) ?? null
              );
            }),
        });
      },
    },
    account: {
      selectionSet: `{
        accountId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.accountId) {
          return null;
        }
        return context.Hashavshevet.Query.getAccountsRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'account')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetAccountsInputToRaw({
              idMin: root.accountId,
              idMax: root.accountId,
            }),
          },
        }).then(res => {
          return res?.status?.repdata && res.status.repdata.length > 0
            ? (res.status.repdata.find(account => account?.id === root.accountId) ?? null)
            : null;
        });
      },
    },
    counterAccount: {
      selectionSet: `{
        counterAccountId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.counterAccountId) {
          return null;
        }
        return context.Hashavshevet.Query.getAccountsRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'counterAccount')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetAccountsInputToRaw({
              idMin: root.counterAccountId,
              idMax: root.counterAccountId,
            }),
          },
        }).then(res => {
          return res?.status?.repdata && res.status.repdata.length > 0
            ? (res.status.repdata.find(account => account?.id === root.counterAccountId) ?? null)
            : null;
        });
      },
    },
  },
  Transaction: {
    batch: {
      selectionSet: `{
        batchId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.batchId) {
          return null;
        }
        return context.Hashavshevet.Query.getBatchRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'batch')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetBatchInputToRaw({
              idMin: root.batchId,
              idMax: root.batchId,
            }),
          },
        }).then(res => {
          return res?.status?.repdata && res.status.repdata.length > 0
            ? (res.status.repdata.find(batch => batch?.id === root.batchId) ?? null)
            : null;
        });
      },
    },
    records: {
      selectionSet: `{
        id
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.id) {
          return [];
        }
        return context.Hashavshevet.Query.getRecordsRaw({
          root,
          context,
          info,
          key: root.id,
          selectionSet: `{
            status {
              repdata {
                transactionId
                ${info.fieldNodes
                  .find(n => n.name.value === 'records')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          argsFromKeys: transactionIds => ({
            input: adjustGetRecordsInputToRaw({
              transactionIdMin: Math.min.apply(null, transactionIds),
              transactionIdMax: Math.max.apply(null, transactionIds),
            }),
          }),
          valuesFromResults: (recordsList, transactionIds) =>
            transactionIds.map(transactionId => {
              return (
                recordsList?.status?.repdata?.filter(
                  record => record?.transactionId === transactionId,
                ) ?? null
              );
            }),
        });
      },
    },
    creditor: {
      selectionSet: `{
        creditorId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.creditorId) {
          return null;
        }
        return context.Hashavshevet.Query.getAccountsRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'creditor')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetAccountsInputToRaw({
              idMin: root.creditorId,
              idMax: root.creditorId,
            }),
          },
        }).then(res => {
          return res?.status?.repdata && res.status.repdata.length > 0
            ? (res.status.repdata.find(account => account?.id === root.creditorId) ?? null)
            : null;
        });
      },
    },
    debtor: {
      selectionSet: `{
        debtorId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.debtorId) {
          return null;
        }
        return context.Hashavshevet.Query.getAccountsRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'debtor')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetAccountsInputToRaw({
              idMin: root.debtorId,
              idMax: root.debtorId,
            }),
          },
        }).then(res => {
          return res?.status.repdata && res.status.repdata.length > 0
            ? (res.status.repdata[0] ?? null)
            : null;
        });
      },
    },
  },
  Batch: {
    transactions: {
      selectionSet: `{
        id
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.id) {
          return [];
        }
        return context.Hashavshevet.Query.getTransactionsRaw({
          root,
          context,
          info,
          key: root.id,
          selectionSet: `{
            status {
              repdata {
                batchId
                ${info.fieldNodes
                  .find(n => n.name.value === 'transactions')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          argsFromKeys: batchIds => ({
            input: adjustGetTransactionsInputToRaw({
              batchIdMin: Math.min.apply(null, batchIds),
              batchIdMax: Math.max.apply(null, batchIds),
            }),
          }),
          valuesFromResults: (transactionsRes, batchIds) =>
            batchIds.map(batchId => {
              return (
                transactionsRes?.status?.repdata?.filter(record => record?.batchId === batchId) ??
                null
              );
            }),
        });
      },
    },
  },
  BankPageRecord: {
    account: {
      selectionSet: `{
        accountId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.accountId) {
          return null;
        }
        return context.Hashavshevet.Query.getAccountsRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'account')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetAccountsInputToRaw({
              idMin: root.accountId,
              idMax: root.accountId,
            }),
          },
        }).then(res => {
          return res?.status?.repdata && res.status.repdata.length > 0
            ? (res.status.repdata.find(account => account?.id === root.accountId) ?? null)
            : null;
        });
      },
    },
  },
  importTransactionsToBatchResponse: {
    batch: {
      selectionSet: `{
      batchno
    }`,
      resolve: async (root, _args, context, info) => {
        if (!root.batchno) {
          return null;
        }
        return context.Hashavshevet.Query.getBatchRaw({
          root,
          context,
          info,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'batch')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          args: {
            input: adjustGetBatchInputToRaw({
              idMin: root.batchno,
              idMax: root.batchno,
            }),
          },
        }).then(res => {
          return res?.status?.repdata && res.status.repdata.length > 0
            ? (res.status.repdata.find(batch => batch?.id === root.batchno) ?? null)
            : null;
        });
      },
    },
  },
  Account: {
    sortCode: {
      selectionSet: `{
        sortCodeId
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.sortCodeId) {
          return null;
        }
        return context.Hashavshevet.Query.getSortCodesRaw({
          root,
          context,
          info,
          key: root.sortCodeId,
          selectionSet: `{
            status {
              repdata {
                code
                ${info.fieldNodes
                  .find(n => n.name.value === 'sortCode')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          argsFromKeys: _sortCodeIds => ({
            input: {
              datafile: sortCodesDataFile,
              parameters: [],
              // TODO: implement min/max filtering
              // idMin: Math.min.apply(null, sortCodeIds),
              // idMax: Math.max.apply(null, sortCodeIds),
            },
          }),
          valuesFromResults: (sortCodesRes, sortCodeIds) =>
            sortCodeIds.map(sortCodeId => {
              return (
                sortCodesRes?.status?.repdata?.find(sortCode => sortCode?.code === sortCodeId) ??
                null
              );
            }),
        });
      },
    },
  },
  SortCode: {
    accounts: {
      selectionSet: `{
        code
      }`,
      resolve: async (root, _args, context, info) => {
        if (!root.code) {
          return [];
        }
        return context.Hashavshevet.Query.getAccountsRaw({
          root,
          context,
          info,
          key: root.code,
          selectionSet: `{
            status {
              repdata {
                id
                ${info.fieldNodes
                  .find(n => n.name.value === 'accounts')
                  ?.selectionSet?.selections.map(s => ('name' in s ? s.name.value : ''))
                  .join('\n')}
              }
            }
          }`,
          argsFromKeys: sortCodes => ({
            input: adjustGetAccountsInputToRaw({
              sortCodeMin: Math.min.apply(null, sortCodes),
              sortCodeMax: Math.max.apply(null, sortCodes),
            }),
          }),
          valuesFromResults: (accountsRes, sortCodes) =>
            sortCodes.map(sortCode => {
              return (
                accountsRes?.status?.repdata?.filter(account => account?.sortCodeId === sortCode) ??
                null
              );
            }),
        });
      },
    },
  },
};

// eslint-disable-next-line import/no-default-export
export default resolvers;

export { resolvers };
