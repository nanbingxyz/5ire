/**
 * ['--db-path',<dbPath>] => dbPath
 */

import { flatten } from 'lodash';
import {
  MCPArgParameter,
  MCPArgType,
  MCPEnvType,
  IMCPServerParameter,
  IMCPServer,
} from 'types/mcp';

export function getParameters(params: string[]): IMCPServerParameter[] {
  const result: IMCPServerParameter[] = [];
  if (!params) {
    return result;
  }
  const pattern =
    /\{\{(?<name>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/;
  params.forEach((param: string) => {
    const match = param.match(pattern);
    if (match && match.groups) {
      result.push({
        name: match.groups.name,
        type: match.groups.type as MCPEnvType | MCPArgType,
        description: match.groups.description || '',
      });
    }
  });
  return result;
}

export function fillArgs(args: string[], params: MCPArgParameter): string[] {
  const pattern =
    /\{\{(?<name>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/;
  const $args: (string | string[])[] = [...args];
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const match = arg.match(pattern);
    if (match && match.groups) {
      const paramValue = params[match.groups.name];
      if (Array.isArray(paramValue)) {
        $args[index] = paramValue;
      } else {
        $args[index] = arg.replace(match[0], paramValue);
      }
    }
  }
  return flatten($args);
}

export function FillEnvOrHeaders(
  envOrHeaders: Record<string, string> | undefined,
  params: { [key: string]: string },
): Record<string, string> {
  if (!envOrHeaders) return {};
  const pattern =
    /\{\{(?<name>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/g;
  const $envOrHeaders = { ...envOrHeaders };
  const keys = Object.keys(envOrHeaders);
  // eslint-disable-next-line no-restricted-syntax
  for (const key of keys) {
    const item = envOrHeaders[key];
    let result = item;
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(item)) !== null) {
      if (match.groups) {
        const placeholder = match[0];
        const paramValue = params[match.groups.name];
        if (paramValue !== undefined) {
          result = result.replace(placeholder, paramValue);
        }
      }
    }

    $envOrHeaders[key] = result;
  }
  return $envOrHeaders;
}

export function purifyServer(
  server: IMCPServer,
): Omit<IMCPServer, 'type' | 'key'> {
  return {
    name: server.name,
    description: server.description,
    url: server.url,
    command: server.command,
    ...(server.args?.length ? { args: server.args } : {}),
    ...(Object.keys(server.headers || {}).length
      ? { headers: server.headers }
      : {}),
    ...(Object.keys(server.env || {}).length ? { env: server.env } : {}),
    isActive: server.isActive || false,
    approvalPolicy: server.approvalPolicy,
    allowSystemEnv: server.allowSystemEnv,
    capabilities: server.capabilities,
  };
}
