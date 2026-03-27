import { startTelemetry } from './telemetry/index.js';

try {
  await startTelemetry();
} catch (error) {
  console.error('OpenTelemetry bootstrap failed.', error);
  process.exit(1);
}
