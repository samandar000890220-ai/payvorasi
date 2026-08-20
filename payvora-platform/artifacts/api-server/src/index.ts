import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from 'http';
import { attachRealtimeWsServer } from './realtimeWsServer';

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app as any);

// Attach optional realtime websocket server. The module will perform
// honest runtime checks and report provider configuration clearly.
(async () => {
  try {
    await attachRealtimeWsServer(server);
  } catch (err) {
    logger.warn({ err }, 'Realtime WS server could not be attached');
  }
})()


server.listen(port, (err?: any) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
