import path from 'path';
import fs from 'node:fs';
import { app } from 'electron';
import { IMCPConfig, IMCPServer } from 'types/mcp';
import { isUndefined, keyBy, omitBy } from 'lodash';
import { purifyServer } from 'utils/mcp';
import * as logging from './logging';

const CONNECT_TIMEOUT = 60 * 1000 * 5; // 5 minutes
const LIST_TOOLS_TIMEOUT = 15 * 1000; // 15 seconds

export const DEFAULT_INHERITED_ENV_VARS =
  process.platform === 'win32'
    ? [
        'APPDATA',
        'HOMEDRIVE',
        'HOMEPATH',
        'LOCALAPPDATA',
        'PATH',
        'PROCESSOR_ARCHITECTURE',
        'SYSTEMDRIVE',
        'SYSTEMROOT',
        'TEMP',
        'USERNAME',
        'USERPROFILE',
      ]
    : /* list inspired by the default env inheritance of sudo */
      ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];
/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
export function getDefaultEnvironment() {
  const env: Record<string, string> = {};
  DEFAULT_INHERITED_ENV_VARS.forEach((key) => {
    const value = process.env[key];
    if (value === undefined) {
      return;
    }
    if (value.startsWith('()')) {
      // Skip functions, which are a security risk.
      return;
    }
    env[key] = value;
  });
  return env;
}

export default class ModuleContext {
  private clients: { [key: string]: any } = {};

  private Client: any;

  private StdioTransport: any;

  private SSETransport: any;

  private StreamableHTTPTransport: any;

  private cfgPath: string;

  constructor() {
    this.cfgPath = path.join(app.getPath('userData'), 'mcp.json');
  }

  public async init() {
    this.Client = await ModuleContext.importClient();
    this.StdioTransport = await ModuleContext.importStdioTransport();
    this.SSETransport = await ModuleContext.importSSETransport();
    this.StreamableHTTPTransport =
      await ModuleContext.importStreamableHTTPTransport();
  }

  private static async importClient() {
    const { Client } = await import(
      '@modelcontextprotocol/sdk/client/index.js'
    );
    return Client;
  }

  private static async importStdioTransport() {
    const { StdioClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/stdio.js'
    );
    return StdioClientTransport;
  }

  private static async importSSETransport() {
    const { SSEClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/sse.js'
    );
    return SSEClientTransport;
  }

  private static async importStreamableHTTPTransport() {
    const { StreamableHTTPClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/streamableHttp.js'
    );
    return StreamableHTTPClientTransport;
  }

  private static getMCPServer(server: IMCPServer, config: IMCPConfig) {
    let mcpSvr = config.mcpServers[server.key];
    mcpSvr = {
      ...mcpSvr,
      ...omitBy({ ...server, isActive: true }, isUndefined),
    } as IMCPServer;
    logging.debug('MCP Server:', mcpSvr);
    return mcpSvr;
  }

  private updateConfigAfterActivation(server: IMCPServer, config: IMCPConfig) {
    config.mcpServers[server.key] = server;
    this.putConfig(config);
  }

  private updateConfigAfterDeactivation(key: string, config: IMCPConfig) {
    config.mcpServers[key] = { ...config.mcpServers[key], isActive: false };
    this.putConfig(config);
  }

  public isServerExist(key: string): boolean {
    const defaultConfig = { mcpServers: {} };
    try {
      if (!fs.existsSync(this.cfgPath)) {
        fs.writeFileSync(this.cfgPath, JSON.stringify(defaultConfig, null, 2));
      }
      const config = JSON.parse(fs.readFileSync(this.cfgPath, 'utf-8'));
      return !!config.mcpServers[key];
    } catch (err: any) {
      logging.captureException(err);
      return false;
    }
  }

  public getConfig(): IMCPConfig {
    const defaultConfig = { mcpServers: {} };
    try {
      if (!fs.existsSync(this.cfgPath)) {
        fs.writeFileSync(this.cfgPath, JSON.stringify(defaultConfig, null, 2));
      }
      const config = JSON.parse(fs.readFileSync(this.cfgPath, 'utf-8'));
      // migration to new config format
      if (config.servers) {
        if (Array.isArray(config.servers) && !config.mcpServers) {
          config.mcpServers = keyBy(config.servers, 'key');
        }
        delete config.servers;
        this.putConfig(config);
      }
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
      // Set key for each server if not already set
      (Object.entries(config.mcpServers) as [string, IMCPServer][]).forEach(
        ([key, server]) => {
          server.key = key;
          if (server.url) {
            server.type = 'remote';
          } else {
            server.type = 'local';
          }
        },
      );
      return config;
    } catch (err: any) {
      logging.captureException(err);
      return defaultConfig;
    }
  }

  public putConfig(config: any) {
    try {
      const newConfig = { ...config };
      Object.keys(newConfig.mcpServers).forEach((key: string) => {
        const svr = newConfig.mcpServers[key];
        newConfig.mcpServers[key] = purifyServer(svr);
      });
      fs.writeFileSync(this.cfgPath, JSON.stringify(newConfig, null, 2));
      return true;
    } catch (err: any) {
      logging.captureException(err);
      return false;
    }
  }

  public async load() {
    const { mcpServers } = await this.getConfig();
    await Promise.all(
      Object.keys(mcpServers).map(async (key: string) => {
        const server = mcpServers[key];
        if (server.isActive) {
          logging.debug('Activating server:', key);
          const { error } = await this.activate(server);
          if (error) {
            logging.error('Failed to activate server:', key, error);
          }
        }
      }),
    );
  }

  public addServer(server: IMCPServer) {
    const config = this.getConfig();
    if (!config.mcpServers[server.key]) {
      config.mcpServers[server.key] = server;
      this.putConfig(config);
      return true;
    }
    return false;
  }

  public async updateServer(server: IMCPServer) {
    const config = await this.getConfig();
    if (config.mcpServers[server.key]) {
      config.mcpServers[server.key] = server;
      await this.putConfig(config);
      return true;
    }
    return false;
  }

  public async activate(server: IMCPServer): Promise<{ error: any }> {
    try {
      const client = new this.Client({
        name: server.key,
        version: '1.0.0',
      });
      const config = this.getConfig();
      const mcpSvr = ModuleContext.getMCPServer(server, config) as IMCPServer;
      if (mcpSvr.url) {
        const options = {} as {
          requestInit: { headers: Record<string, string> };
          // Optionally add proxy support here if the transport supports it
          // proxy?: string;
        };
        if (mcpSvr.headers) {
          options.requestInit = { headers: mcpSvr.headers };
        }
        // If proxy is set, pass it to the transport if supported (TODO: implement in transport)
        // if (mcpSvr.proxy) {
        //   options.proxy = mcpSvr.proxy;
        // }
        const isSSE = mcpSvr.url.endsWith('sse');
        const PrimaryTransport = isSSE
          ? this.SSETransport
          : this.StreamableHTTPTransport;
        const SecondaryTransport = isSSE
          ? this.StreamableHTTPTransport
          : this.SSETransport;
        try {
          const transport = new PrimaryTransport(new URL(mcpSvr.url), options);
          await client.connect(transport, { timeout: CONNECT_TIMEOUT });
        } catch (error) {
          logging.captureException(error as Error);
          console.log(
            'Streamable HTTP connection failed, falling back to SSE transport',
          );
          const transport = new SecondaryTransport(
            new URL(mcpSvr.url),
            options,
          );
          await client.connect(transport, { timeout: CONNECT_TIMEOUT });
        }
      } else {
        const { command, args, env, proxy } = mcpSvr;
        let cmd: string = command as string;
        if (command === 'npx') {
          cmd = process.platform === 'win32' ? `${command}.cmd` : command;
        }
        const mergedEnv = {
          ...getDefaultEnvironment(),
          ...env,
          PATH: process.env.PATH,
          ...(proxy
            ? {
                // Basic validation: ensure proxy URL looks valid
                ...((() => {
                  try {
                    new URL(proxy);
                  } catch (error) {
                    logging.error(`Invalid proxy URL: ${proxy}`, error);
                    throw new Error(`Invalid proxy URL: ${proxy}`);
                  }
                  return {};
                })()),
                HTTP_PROXY: proxy,
                HTTPS_PROXY: proxy,
                ALL_PROXY: proxy,
              }
            : {}),
        };
        const transport = new this.StdioTransport({
          command: cmd,
          args,
          stderr: process.platform === 'win32' ? 'pipe' : 'inherit',
          env: mergedEnv,
        });
        await client.connect(transport, { timeout: CONNECT_TIMEOUT });
      }
      this.clients[server.key] = client;
      this.updateConfigAfterActivation(mcpSvr, config);
      return { error: null };
    } catch (error: any) {
      logging.captureException(error);
      this.deactivate(server.key);
      return { error };
    }
  }

  public async deactivate(key: string) {
    try {
      if (this.clients[key]) {
        await this.clients[key].close();
        delete this.clients[key];
        logging.debug('Deactivating server:', key);
      }
      this.updateConfigAfterDeactivation(key, this.getConfig());
      return { error: null };
    } catch (error: any) {
      logging.captureException(error);
      return { error };
    }
  }

  public async close() {
    await Promise.all(
      Object.keys(this.clients).map(async (key) => {
        logging.info(`Closing MCP Client ${key}`);
        await this.clients[key].close();
        delete this.clients[key];
      }),
    );
  }

  /**
   * Close & reactivate a client without ping
   */
  private async reconnect(key: string) {
    logging.info(`Reconnecting MCP Client ${key}`);
    const cfg = this.getConfig();
    const server = cfg.mcpServers[key];
    if (!server) throw new Error(`Server ${key} not found`);
    if (this.clients[key]) {
      try {
        await this.clients[key].close();
      } catch {
        // ignore error
      }
    }
    const { error } = await this.activate(server);
    if (error) throw error;
  }

  /**
   * Executes an MCP client call, reconnecting once on failure and retrying.
   */
  // helper to retry a client call once after reconnect
  // optional timeoutMs to set a timeout for the call
  private async safeCall(
    clientKey: string,
    fn: () => Promise<any>,
    timeoutMs?: number,
  ): Promise<any> {
    if (!this.clients[clientKey])
      throw new Error(`Client ${clientKey} not found`);
    try {
      if (!timeoutMs) {
        return await fn();
      }
      const res = await Promise.race([
        fn(),
        new Promise<any>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('invalid_connection'));
          }, timeoutMs);
        }),
      ]);
      return res;
    } catch {
      await this.reconnect(clientKey);
      return fn();
    }
  }

  public async listTools(key?: string) {
    const clients = key ? [key] : Object.keys(this.clients);
    const timeoutMs = LIST_TOOLS_TIMEOUT;
    // perform listTools on all clients in parallel
    const results = await Promise.all(
      clients.map(async (clientKey) => {
        try {
          const res = await this.safeCall(
            clientKey,
            () => this.clients[clientKey].listTools(),
            timeoutMs,
          );
          if (!res?.tools || !Array.isArray(res.tools))
            throw new Error('invalid_response');
          // tag and return successful tools
          return {
            client: clientKey,
            tools: res.tools.map((t: any) => ({
              ...t,
              name: `${clientKey}--${t.name}`,
            })),
            error: null,
          };
        } catch (err: any) {
          // capture failure for this client
          return { client: clientKey, tools: [], error: err.message };
        }
      }),
    );
    // flatten tools and collect failures
    const tools = results.flatMap((r) => r.tools);
    const failedClients = results
      .filter((r) => r.error)
      .map((r) => ({ client: r.client, error: r.error! }));
    return {
      tools,
      error: failedClients.length
        ? {
            message: key
              ? `Failed to list tools for ${key}`
              : 'Partial failure listing tools',
            code: key ? 'list_tools_failed' : 'partial_failure',
            failedClients,
          }
        : null,
    };
  }

  public async callTool({
    client,
    name,
    args,
    signal
  }: {
    client: string;
    name: string;
    args: any;
    signal?: AbortSignal;
  }) {
    if (!this.clients[client]) {
      return {
        isError: true,
        content: [
          {
            error: `MCP Client ${client} not found`,
            code: 'client_not_found',
            clientName: client,
            toolName: name,
          },
        ],
      };
    }
    const callFn = () =>
      this.clients[client].callTool({ name, arguments: args }, undefined, {
        timeout: CONNECT_TIMEOUT,
        signal,
      });
    try {
      const result = await this.safeCall(client, callFn);
      return { isError: false, ...result };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            error: `Error calling tool ${name}: ${err.message}`,
            code: 'tool_call_error',
            clientName: client,
            toolName: name,
          },
        ],
      };
    }
  }

  public getClient(name: string) {
    return this.clients[name];
  }

  public getClientNames() {
    return Object.keys(this.clients);
  }
}
