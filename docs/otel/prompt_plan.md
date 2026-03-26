# OTEL Implementation Prompt Plan

This document outlines the step-by-step plan to implement OpenTelemetry (OTEL) tracing in the
server. It assumes the specification in `docs/otel/spec.md` is the source of truth.

## Phase 1: Foundation & Configuration

**Goal**: Establish the environment variables, type safety, and basic dependency structure without
activating the SDK yet.

### Step 1: Install Dependencies & Setup Directory Structure

We need the core packages to compile the code in later steps. We also need a place for the new code
to live.

**Prompt 1**:

```text
I am implementing OpenTelemetry in the server package.

1.  Add the following dependencies to `packages/server/package.json`:
    *   `@opentelemetry/api`
    *   `@opentelemetry/sdk-node`
    *   `@opentelemetry/auto-instrumentations-node`
    *   `@opentelemetry/exporter-trace-otlp-http`
    *   `@opentelemetry/resources`
    *   `@opentelemetry/semantic-conventions`

2.  Run `yarn` to install them.

3.  Create a new directory `packages/server/src/telemetry`.

4.  Create a file `packages/server/src/telemetry/index.ts` that exports a simple placeholder function `export async function startTelemetry() { console.log('Telemetry implementation pending'); }` just to verify the folder structure is correct.
```

### Step 2: Environment Variable Configuration

We need to parse and validate the OTEL configuration in `environment.ts` before we use it.

**Prompt 2**:

```text
I need to add OpenTelemetry configuration to the server's environment parsing logic.

Reference `packages/server/src/environment.ts`.

1.  Define a new Zod schema `OtelModel` that supports:
    *   `OTEL_ENABLED`: "1" or "0" (optional, default "0").
    *   `OTEL_SERVICE_NAME`: string (default "accounter-server").
    *   `OTEL_SERVICE_NAMESPACE`: string (default "accounter").
    *   `OTEL_DEPLOYMENT_ENV`: string (default "development").
    *   `OTEL_EXPORTER_OTLP_ENDPOINT`: string (required if ENABLED is "1").
    *   `OTEL_EXPORTER_OTLP_HEADERS`: string (optional, key=value format).
    *   `OTEL_TRACES_SAMPLER`: enum ("parentbased_traceidratio", "always_on", "always_off") (default "always_on").
    *   `OTEL_TRACES_SAMPLER_ARG`: number string (0-1) (optional).
    *   `OTEL_STARTUP_STRICT`: "true" or "false" (optional, boolean logic).

2.  Add a validation refinement: If `OTEL_ENABLED` is "1", `OTEL_EXPORTER_OTLP_ENDPOINT` must be defined.

3.  Integrate this into the `configs` object and the final `env` export in `packages/server/src/environment.ts` under a new `otel` key.

4.  Create a test file `packages/server/src/__tests__/environment-otel.test.ts` to verify:
    *   Default values when envs are missing.
    *   Validation failure when enabled but endpoint is missing.
    *   Correct parsing of valid configurations.
```

## Phase 2: Core SDK Implementation

**Goal**: Implement the actual SDK initialization logic in isolation.

### Step 3: Telemetry Builder Module

Create the module that constructs the NodeSDK instance based on the config.

**Prompt 3**:

```text
Implement the OpenTelemetry SDK builder in `packages/server/src/telemetry/builder.ts`.

1.  Import `env` from `../environment.js`.
2.  Create a function `buildOtelSdk()` that:
    *   Checks `env.otel.enabled`. If false, returns null.
    *   Configures `Resource` with semantic conventions (SERVICE_NAME, SERVICE_NAMESPACE, DEPLOYMENT_ENVIRONMENT).
    *   Configures `OTLPTraceExporter` with the endpoint and headers from `env.otel`.
    *   Configures `NodeSDK` with:
        *   The resource and trace exporter.
        *   `getNodeAutoInstrumentations()` for now (we will tune this later).
    *   Returns the initialized `NodeSDK` instance.

3.  Create a test file `packages/server/src/telemetry/__tests__/builder.test.ts` that mocks `env` and asserts that `NodeSDK` is constructed with the correct properties when enabled, and returns null when disabled.
```

### Step 4: Lifecycle Management (Start/Stop)

Manage the global singleton state of the SDK to ensure we don't start it twice and can shut it down
cleanly.

**Prompt 4**:

```text
Implement the telemetry lifecycle management in `packages/server/src/telemetry/index.ts`.

1.  Import `buildOtelSdk` from `./builder.js`.
2.  Maintain a module-level variable `sdk: NodeSDK | null`.
3.  Export a function `startTelemetry()`:
    *   Call `buildOtelSdk`.
    *   If an SDK is returned, call `sdk.start()`.
    *   Handle start errors:
        *   If `env.otel.strictStartup` is true, throw the error.
        *   Otherwise, log the error and continue.
4.  Export a function `shutdownTelemetry()`:
    *   If `sdk` exists, call `sdk.shutdown()`.
    *   Log success or failure.

5.  Update `packages/server/src/telemetry/__tests__/builder.test.ts` (or create `index.test.ts`) to test the strict vs non-strict error handling behavior.
```

## Phase 3: Integration & Wiring

**Goal**: Hook the telemetry into the application startup and shutdown sequence.

### Step 5: Pre-Import Initialization (The "Import Hook")

OTEL must run _before_ other modules.

**Prompt 5**:

```text
We need to ensure telemetry starts before the application loads.

1.  Create a new entrypoint file `packages/server/src/bootstrap-telemetry.ts`.
    *   This file should import `startTelemetry` from `./telemetry/index.js` and await it.
    *   It should catch any errors (though `startTelemetry` handles most logic, this is a top-level safety net).

2.  Modify `packages/server/package.json` scripts.
    *   Create a specific start script or update the existing `start` script.
    *   Since we are using `tsx` often or `node dist/...`, the strategy depends on the environment.
    *   For `dev` (using nodemon/tsx): Ensure `bootstrap-telemetry.ts` is imported or run before `index.ts`.
    *   For `start` (prod): We likely need to compile `bootstrap-telemetry.ts` or reference the dist version.

    *Proposal*: Let's modify `src/index.ts` to import the bootstrap function *first thing*. While standard Node.js OTEL docs recommend a separate CLI flag (`--require`), importing it as the very first line of `index.ts` is often sufficient for `auto-instrumentations-node` in modern bundlers/TS setups, provided no other imports (like `pg` or `http`) define global singletons before that line executes.

    *Revised Plan for this step*:
    Update `packages/server/src/index.ts`:
    1.  Add `import { startTelemetry, shutdownTelemetry } from './telemetry/index.js';` at the absolute top.
    2.  Inside `main()`, call `await startTelemetry()` as the very first operation.
```

### Step 6: Graceful Shutdown Integration

Ensure spans are flushed when the server stops.

**Prompt 6**:

```text
Integrate telemetry shutdown into the server's graceful shutdown lifecycle.

Reference `packages/server/src/index.ts`.

1.  In the `gracefulShutdown` function:
    *   Add a call to `await shutdownTelemetry()` before the process exits.
    *   Place it *after* the server closes functionality but *before* the force exit timeout kills the process.
    *   Ensure that if `shutdownTelemetry` hangs, the force exit timer still works.
```

## Phase 4: Validation & Tuning

**Goal**: Verify it works and clean up the data.

### Step 7: Auto-Instrumentation Tuning

We want to reduce noise and potential PII.

**Prompt 7**:

```text
Tune the auto-instrumentation configuration in `packages/server/src/telemetry/builder.ts`.

1.  Update `getNodeAutoInstrumentations()` usage to pass a configuration object.
2.  Specifically configure `@opentelemetry/instrumentation-fs` to `enabled: false` (too noisy usually).
3.  Configure `@opentelemetry/instrumentation-http`:
    *   Add a `ignoreIncomingRequestHook` to filter out health checks (e.g., `/health`, `/readiness`) if they exist (check `src/index.ts` or yoga setup).
4.  Configure `@opentelemetry/instrumentation-graphql`:
    *   Ensure it is enabled.
    *   (Future: We might need a custom hook here for sanitization, but let's stick to defaults for the first pass).
```

### Step 8: Integration Test

Verify the integration with a "black box" test.

**Prompt 8**:

```text
Create an integration test to verify spans are actually generated.

1.  Create `packages/server/src/__tests__/telemetry-integration.test.ts`.
2.  Use `vitest`.
3.  This test is tricky because it involves global state.
    *   Mock `@opentelemetry/sdk-node` or `InMemorySpanExporter`.
    *   Actually, a better approach for *integration* is to use `InMemorySpanExporter` from `@opentelemetry/sdk-trace-base`.
4.  In the test:
    *   Set `OTEL_ENABLED=1` in `process.env`.
    *   Import `startTelemetry`.
    *   Start the telemetry.
    *   Perform a simple action (like a dummy HTTP fetch or a mocked PG query if possible, or just checking if the SDK started).
    *   *Self-correction*: Testing full HTTP/PG instrumentation in unit tests is hard.
    *   Let's focus on: calling `startTelemetry` with valid env vars results in `sdk.start()` being called.
    *   Mock `NodeSDK` prototypal methods to verify interaction.
```

## Phase 5: Documentation

### Step 9: Documentation

Update the README.

**Prompt 9**:

```text
Update `packages/server/README.md` with a new section "Observability".

1.  List the new Environment Variables from `spec.md` (packages/server/src/environment.ts).
2.  Explain how to enable tracing locally (e.g., enable OTEL, point to a local Tempo/Jaeger).
3.  Provide a small example snippet of a valid `.env` configuration for tracing.
```
