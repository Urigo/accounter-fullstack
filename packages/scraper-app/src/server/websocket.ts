import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import websocketPlugin from '@fastify/websocket';
import { ClientMessageSchema, type ServerMessage } from '../shared/ws-protocol.js';
import { submitOtp } from './otp-manager.js';
import { startRun } from './scrape-runner.js';
import { isLocked } from './vault-store.js';

function send(socket: WebSocket, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
}

export async function registerWebSocketRoute(app: FastifyInstance): Promise<void> {
  await app.register(websocketPlugin);

  app.get(
    '/ws',
    {
      websocket: true,
      preValidation: async (_req, reply) => {
        if (isLocked()) {
          await reply.status(401).send({ error: 'vault-locked' });
        }
      },
    },
    (socket: WebSocket, _req) => {
      socket.on('error', err => app.log.error({ err }, '[ws] socket error'));
      send(socket, { type: 'connected' });

      socket.on('message', (raw: RawData) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          app.log.warn('[ws] non-JSON message received');
          return;
        }

        const result = ClientMessageSchema.safeParse(parsed);
        if (!result.success) {
          app.log.warn({ received: parsed }, '[ws] unknown message type — ignored');
          return;
        }

        const msg = result.data;
        switch (msg.type) {
          case 'ping':
            send(socket, { type: 'pong' });
            break;
          case 'run-start':
            void startRun(socket, msg).catch((err: unknown) => {
              app.log.error(err, '[ws] startRun error');
              send(socket, { type: 'error', message: String(err) });
            });
            break;
          case 'start-scrape':
            // legacy alias — forwards to run-start
            void startRun(socket, { type: 'run-start', sourceIds: msg.sourceIds }).catch(
              (err: unknown) => {
                app.log.error(err, '[ws] startRun error');
                send(socket, { type: 'error', message: String(err) });
              },
            );
            break;
          case 'otp-submit':
            submitOtp(msg.sourceId, msg.otp);
            break;
          case 'cancel-scrape':
            // TODO: cancel in-progress scrape
            break;
        }
      });
    },
  );
}
