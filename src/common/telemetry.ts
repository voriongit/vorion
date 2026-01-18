/**
 * OpenTelemetry SDK Setup
 *
 * Initializes distributed tracing with configurable exporters.
 * Supports OTLP export for Jaeger, Tempo, or other OTLP-compatible backends.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger({ component: 'telemetry' });

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 */
export function initTelemetry(): void {
  const config = getConfig();

  if (!config.telemetry.enabled) {
    logger.info('Telemetry disabled');
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: config.telemetry.otlpEndpoint,
    headers: config.telemetry.otlpHeaders,
  });

  sdk = new NodeSDK({
    serviceName: config.telemetry.serviceName,
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable some noisy auto-instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        // Enable HTTP instrumentation for API tracing
        '@opentelemetry/instrumentation-http': { enabled: true },
        // Enable Redis instrumentation for queue tracing
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
        // Enable Fastify instrumentation
        '@opentelemetry/instrumentation-fastify': { enabled: true },
      }),
    ],
  });

  sdk.start();

  logger.info(
    { endpoint: config.telemetry.otlpEndpoint, service: config.telemetry.serviceName },
    'Telemetry initialized'
  );
}

/**
 * Shutdown OpenTelemetry SDK gracefully
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('Telemetry shutdown complete');
    } catch (error) {
      logger.error({ error }, 'Error shutting down telemetry');
    }
  }
}
