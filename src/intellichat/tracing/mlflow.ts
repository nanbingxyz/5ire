/**
 * MLflow Tracing Integration
 *
 * This module provides MLflow tracing capabilities for all LLM providers.
 * It automatically instruments LLM calls to capture traces, including:
 * - Input messages and parameters
 * - Response content and metadata
 * - Token usage and costs
 * - Latency and performance metrics
 * - Error handling and exceptions
 */

import * as mlflow from 'mlflow-tracing';
import { tracedOpenAI } from 'mlflow-openai';
import { OpenAI } from 'openai';
import Store from 'electron-store';
import log from 'electron-log';

export interface MLflowConfig {
  enabled: boolean;
  trackingUri: string;
  experimentId: string;
  experimentName?: string;
}

let isInitialized = false;
let config: MLflowConfig | null = null;

/**
 * Initialize MLflow tracing with configuration from electron-store
 */
export function initMLflow(store: Store): boolean {
  try {
    // Get MLflow configuration from electron-store
    const mlflowConfig = store.get('mlflow') as MLflowConfig | undefined;

    if (!mlflowConfig?.enabled) {
      log.info('MLflow tracing is disabled');
      return false;
    }

    if (!mlflowConfig.trackingUri || !mlflowConfig.experimentId) {
      log.warn('MLflow tracing is enabled but trackingUri or experimentId is missing');
      return false;
    }

    config = mlflowConfig;

    // Initialize MLflow with the tracking URI and experiment ID
    mlflow.init({
      trackingUri: config.trackingUri,
      experimentId: config.experimentId,
    });

    isInitialized = true;
    log.info(`MLflow tracing initialized successfully. Tracking URI: ${config.trackingUri}, Experiment ID: ${config.experimentId}`);
    return true;
  } catch (error) {
    log.error('Failed to initialize MLflow tracing:', error);
    isInitialized = false;
    return false;
  }
}

/**
 * Get the current MLflow configuration
 */
export function getMLflowConfig(): MLflowConfig | null {
  return config;
}

/**
 * Check if MLflow tracing is initialized and enabled
 */
export function isMLflowEnabled(): boolean {
  return isInitialized && config?.enabled === true;
}

/**
 * Wrap OpenAI client with MLflow tracing
 */
export function wrapOpenAI(client: OpenAI): OpenAI {
  if (!isMLflowEnabled()) {
    return client;
  }

  try {
    return tracedOpenAI(client);
  } catch (error) {
    log.error('Failed to wrap OpenAI client with MLflow tracing:', error);
    return client;
  }
}

/**
 * Trace a generic LLM call (for providers other than OpenAI)
 *
 * @param fn The function to trace
 * @param options Tracing options
 * @returns The traced function
 */
export function traceLLMCall<T extends (...args: any[]) => any>(
  fn: T,
  options?: {
    name?: string;
    spanType?: mlflow.SpanType;
    attributes?: Record<string, any>;
  }
): T {
  if (!isMLflowEnabled()) {
    return fn;
  }

  try {
    return mlflow.trace(fn, {
      name: options?.name,
      spanType: options?.spanType || mlflow.SpanType.LLM,
      attributes: options?.attributes,
    }) as T;
  } catch (error) {
    log.error('Failed to trace LLM call:', error);
    return fn;
  }
}

/**
 * Create a traced span for a block of code
 *
 * @param fn The function to execute within a span
 * @param options Span options
 * @returns Promise with the function result
 */
export async function withTracedSpan<T>(
  fn: () => Promise<T> | T,
  options: {
    name: string;
    spanType?: mlflow.SpanType;
    attributes?: Record<string, any>;
  }
): Promise<T> {
  if (!isMLflowEnabled()) {
    return fn();
  }

  try {
    return await mlflow.withSpan(fn, {
      name: options.name,
      spanType: options.spanType || mlflow.SpanType.AGENT,
      attributes: options.attributes,
    });
  } catch (error) {
    log.error('Failed to create traced span:', error);
    return fn();
  }
}

/**
 * Export mlflow module for direct access
 */
export { mlflow };

/**
 * Export SpanType enum for convenience
 */
export const SpanType = mlflow.SpanType;
