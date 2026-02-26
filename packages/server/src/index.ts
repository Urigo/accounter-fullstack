/**
 * Bootstrap entry point for the GraphQL server.
 *
 * IMPORTANT: OpenTelemetry auto-instrumentation must be initialized BEFORE
 * any instrumented modules (pg, http, etc.) are imported. This file ensures
 * that by:
 * 1. Loading environment configuration
 * 2. Initializing OTEL SDK
 * 3. Dynamically importing the app module (which loads pg, http, etc.)
 */

import { env } from './environment.js';
import { initOtel } from './otel.js';

// Initialize OpenTelemetry SDK BEFORE importing any instrumented modules
initOtel(env.otel);

// Dynamically import the app to ensure OTEL is set up first
const { startServer } = await import('./app.js');

// Start the server
startServer();
