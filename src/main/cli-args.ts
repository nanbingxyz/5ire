/**
 * CLI argument parser for terminal startup arguments
 * Supports creating chats with pre-configured settings via command line
 */

import path from 'path';
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
  // Debug: log the raw argv to understand what we're receiving
  logging.info(
    'parseStartupArgs received argv:',
    JSON.stringify(argv, null, 2),
  );

  // Check if --new-chat or --chat flag is present
  if (!argv.includes('--new-chat') && !argv.includes('--chat')) {
    return null;
  }

  // Handle --chat JSON format
  const chatIndex = argv.indexOf('--chat');
  if (chatIndex !== -1) {
    try {
      // Find the next non-flag argument after --chat
      for (let i = chatIndex + 1; i < argv.length; i += 1) {
        const arg = argv[i];
        if (!arg.startsWith('--') && !arg.endsWith('.js') && arg !== '.') {
          const parsed = JSON.parse(arg);
          return normalizeStartupArgs(parsed);
        }
      }
    } catch (error) {
      logging.error('Failed to parse --chat JSON argument:', error);
      return null;
    }
  }

  // Manual parsing to handle electronmon's scrambled argument order
  // Strategy: Collect all our flags in order, then collect all non-flag values in order,
  // then match them up

  const ourFlags = [
    '--provider',
    '--model',
    '--system',
    '--summary',
    '--prompt',
    '--temperature',
  ];
  const foundFlags: string[] = [];
  const values: string[] = [];

  // First pass: collect which of our flags are present (in order)
  argv.forEach((arg) => {
    if (ourFlags.includes(arg)) {
      foundFlags.push(arg);
    }
  });

  // Second pass: collect all non-flag, non-electron values (in order)
  argv.forEach((arg, index) => {
    // Skip flags, loader files, working-directory markers, and the executable itself
    if (arg.startsWith('--')) {
      return;
    }
    if (arg.endsWith('.js') || arg.endsWith('.cjs') || arg.endsWith('.mjs')) {
      return;
    }
    if (arg === '.' || arg === '..') {
      return;
    }
    if (arg.includes('electron.exe')) {
      return;
    }

    // Skip the first entry (the executable path) and any explicit executables
    if (index === 0) {
      return;
    }
    if (arg.toLowerCase().endsWith('.exe')) {
      return;
    }
    if (
      process.execPath &&
      path.normalize(arg) === path.normalize(process.execPath)
    ) {
      return;
    }

    values.push(arg);
  });

  logging.info('Found flags:', foundFlags);
  logging.info('Found values:', values);

  // Match flags to values by position
  const args: StartupChatArgs = {};

  for (let i = 0; i < foundFlags.length && i < values.length; i += 1) {
    const flag = foundFlags[i];
    const value = values[i];

    switch (flag) {
      case '--provider':
        args.provider = value;
        break;
      case '--model':
        args.model = value;
        break;
      case '--system':
        args.system = value;
        break;
      case '--summary':
        args.summary = value;
        break;
      case '--prompt':
        args.prompt = value;
        break;
      case '--temperature': {
        const temp = parseFloat(value);
        if (!Number.isNaN(temp)) {
          args.temperature = temp;
        }
        break;
      }
      default:
        break;
    }
  }

  logging.info('Matched args:', args);

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
  // Use regex to ensure proper format: exactly one colon with non-empty parts
  if (normalized.model) {
    const modelMatch = normalized.model.match(/^([^:]+):([^:]+)$/);
    if (modelMatch) {
      const [, provider, model] = modelMatch;
      // Only set provider if not already explicitly provided
      if (!normalized.provider) {
        normalized.provider = provider;
      }
      // Always normalize model to remove provider prefix
      normalized.model = model;
    }
  }

  // Return null if no meaningful arguments were provided
  if (Object.keys(normalized).length === 0) {
    return null;
  }

  return normalized;
}
