import { describe, expect, test } from '@jest/globals';
import { parseStartupArgs } from '../../src/main/cli-args';

describe('main/cli-args', () => {
  test('should return null when no startup arguments are present', () => {
    const result = parseStartupArgs(['node', 'app.js']);
    expect(result).toBeNull();
  });

  test('should parse --new-chat with individual flags', () => {
    const argv = [
      'node',
      'app.js',
      '--new-chat',
      '--provider',
      'openai',
      '--model',
      'gpt-4',
      '--system',
      'You are a helpful assistant',
      '--summary',
      'Test Chat',
      '--prompt',
      'Hello, world!',
      '--temperature',
      '0.7',
    ];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-4',
      system: 'You are a helpful assistant',
      summary: 'Test Chat',
      prompt: 'Hello, world!',
      temperature: 0.7,
    });
  });

  test('should parse --new-chat with partial flags', () => {
    const argv = ['node', 'app.js', '--new-chat', '--provider', 'anthropic'];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      provider: 'anthropic',
    });
  });

  test('should parse --chat with JSON argument', () => {
    const argv = [
      'node',
      'app.js',
      '--chat',
      JSON.stringify({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
      }),
    ];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
    });
  });

  test('should derive provider from model in "Provider:model" format', () => {
    const argv = ['node', 'app.js', '--new-chat', '--model', 'anthropic:claude-3-opus'];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      provider: 'anthropic',
      model: 'claude-3-opus',
    });
  });

  test('should normalize model format even when explicit provider is set', () => {
    const argv = [
      'node',
      'app.js',
      '--new-chat',
      '--provider',
      'openai',
      '--model',
      'anthropic:claude-3-opus',
    ];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      provider: 'openai',
      model: 'claude-3-opus',
    });
  });

  test('should handle invalid JSON gracefully', () => {
    const argv = ['node', 'app.js', '--chat', '{invalid json}'];
    const result = parseStartupArgs(argv);
    expect(result).toBeNull();
  });

  test('should handle missing value after flag', () => {
    const argv = ['node', 'app.js', '--new-chat', '--provider'];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({});
  });

  test('should parse temperature as number', () => {
    const argv = ['node', 'app.js', '--new-chat', '--temperature', '1.5'];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      temperature: 1.5,
    });
  });

  test('should ignore invalid temperature', () => {
    const argv = ['node', 'app.js', '--new-chat', '--temperature', 'invalid'];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({});
  });

  test('should handle complex JSON with nested properties', () => {
    const argv = [
      'node',
      'app.js',
      '--chat',
      JSON.stringify({
        provider: 'openai',
        model: 'gpt-4',
        system: 'You are a helpful assistant',
        summary: 'Complex Chat',
        prompt: 'Tell me a story',
        temperature: 0.8,
      }),
    ];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-4',
      system: 'You are a helpful assistant',
      summary: 'Complex Chat',
      prompt: 'Tell me a story',
      temperature: 0.8,
    });
  });

  test('should derive provider from model in JSON format', () => {
    const argv = [
      'node',
      'app.js',
      '--chat',
      JSON.stringify({
        model: 'anthropic:claude-3-sonnet',
      }),
    ];
    const result = parseStartupArgs(argv);
    expect(result).toEqual({
      provider: 'anthropic',
      model: 'claude-3-sonnet',
    });
  });
});
