import { GmailServiceProvider } from '@modules/app-providers/gmail-listener/gmail-service.provider.js';
import { PubsubServiceProvider } from '@modules/app-providers/gmail-listener/pubsub-service.provider.js';
import type { CommonModule } from '../types.js';

export const gmailListenerResolvers: CommonModule.Resolvers = {
  Query: {
    gmailListenerStatus: (_, __, { injector }) => {
      return injector.get(PubsubServiceProvider).healthCheck();
    },
  },
  Mutation: {
    startGmailListener: async (_, __, { injector }) => {
      try {
        await injector.get(GmailServiceProvider).init();
        await injector.get(PubsubServiceProvider).startListening();

        return true;
      } catch (error) {
        console.error('Failed to start Gmail listener:', error);
        return false;
      }
    },
    stopGmailListener: async (_, __, { injector }) => {
      try {
        await injector.get(PubsubServiceProvider).stopListening();

        return true;
      } catch (error) {
        console.error('Failed to stop Gmail listener:', error);
        return false;
      }
    },
    digestGmailMessages: async (_, __, { injector }) => {
      try {
        await injector.get(GmailServiceProvider).triggerHandlePendingMessages();

        return true;
      } catch (error) {
        console.error('Failed to digest Gmail messages:', error);
        return false;
      }
    },
  },
};
