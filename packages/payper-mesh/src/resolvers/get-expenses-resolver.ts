import type { Resolvers } from '../mesh-artifacts/index.js';

const resolvers: Resolvers = {
  Query: {
    getExpenses: (root, args, context, info) => {
      args.input ||= {};
      if ('userName' in context && !args.input.api_user) {
        args.input.api_user = context['userName'] as string;
      }
      return context.Payper.Query.getExpenses({
        root,
        args,
        context,
        info,
      }).then(async res => {
        // fix for Payper returning Null in cases currency is "ILS"
        const adjustedRes = await res;
        adjustedRes?.expenses?.map(expense => {
          if (expense) {
            expense.currency_symbol ??= 'ILS';
          }
        });
        return res ?? null;
      });
    },
  },
};

// eslint-disable-next-line import/no-default-export
export default resolvers;

export { resolvers };
