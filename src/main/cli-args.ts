/**
 * CLI argument parser for terminal startup arguments
 * Supports creating chats with pre-configured settings via command line
 */

import * as logging from './logging';

export interface StartupChatArgs {
  provider?: string;
  model?: string;
  system?: string;
  summary?: string;
  prompt?: string;
  temperature?: number;
}

/**
 * Parse CLI arguments to extract chat configuration
 * Supports both individual flags and JSON format
 * 
 * @param argv - Command line arguments array
 * @returns Parsed chat arguments or null if no chat arguments found
 */
export function parseStartupArgs(argv: string[]): StartupChatArgs | null {
  // Check if --new-chat flag is present
  const hasNewChat = argv.includes('--new-chat');
  
  // Check for --chat JSON argument
  const chatIndex = argv.indexOf('--chat');
  if (chatIndex !== -1 && chatIndex + 1 < argv.length) {
    try {
      const chatJson = argv[chatIndex + 1];
      const parsed = JSON.parse(chatJson);
      return normalizeStartupArgs(parsed);
    } catch (error) {
      logging.error('Failed to parse --chat JSON argument:', error);
      return null;
    }
  }
  
  // If --new-chat flag is not present, return null
  if (!hasNewChat) {
    return null;
  }
  
  // Parse individual flags
  const args: StartupChatArgs = {};
  
  const providerIndex = argv.indexOf('--provider');
  if (providerIndex !== -1 && providerIndex + 1 < argv.length) {
    args.provider = argv[providerIndex + 1];
  }
  
  const modelIndex = argv.indexOf('--model');
  if (modelIndex !== -1 && modelIndex + 1 < argv.length) {
    args.model = argv[modelIndex + 1];
  }
  
  const systemIndex = argv.indexOf('--system');
  if (systemIndex !== -1 && systemIndex + 1 < argv.length) {
    args.system = argv[systemIndex + 1];
  }
  
  const summaryIndex = argv.indexOf('--summary');
  if (summaryIndex !== -1 && summaryIndex + 1 < argv.length) {
    args.summary = argv[summaryIndex + 1];
  }
  
  const promptIndex = argv.indexOf('--prompt');
  if (promptIndex !== -1 && promptIndex + 1 < argv.length) {
    args.prompt = argv[promptIndex + 1];
  }
  
  const temperatureIndex = argv.indexOf('--temperature');
  if (temperatureIndex !== -1 && temperatureIndex + 1 < argv.length) {
    const temp = parseFloat(argv[temperatureIndex + 1]);
    if (!Number.isNaN(temp)) {
      args.temperature = temp;
    }
  }
  
  return normalizeStartupArgs(args);
}

/**
 * Normalize startup arguments, extracting provider from model if needed
 * Supports format: "Provider:model"
 * 
 * @param args - Raw startup arguments
 * @returns Normalized startup arguments
 */
function normalizeStartupArgs(args: StartupChatArgs): StartupChatArgs | null {
  const normalized = { ...args };
  
  // If model contains "Provider:model" format, extract and normalize
  if (normalized.model && normalized.model.includes(':')) {
    const modelParts = normalized.model.split(':');
    if (modelParts.length === 2) {
      // Only set provider if not already explicitly provided
      if (!normalized.provider) {
        normalized.provider = modelParts[0];
      }
      // Always normalize model to remove provider prefix
      normalized.model = modelParts[1];
    }
  }
  
  // Return null if no meaningful arguments were provided
  if (Object.keys(normalized).length === 0) {
    return null;
  }
  
  return normalized;
}
