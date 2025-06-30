export type MCPServerType = 'local' | 'remote';
export interface IMCPServer {
  key: string;
  type: MCPServerType;
  name?: string;
  url?: string;
  command?: string;
  description?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  isActive: boolean;
  homepage?: string;
  proxy?: string; // Optional: Proxy URL for this entrypoint (e.g., "http://localhost:8080")
}

export type MCPArgType = 'string' | 'list' | 'number';
export type MCPEnvType = 'string' | 'number';
export type MCPArgParameter = { [key: string]: MCPArgType };
export type MCPEnvParameter = { [key: string]: MCPEnvType };

export interface IMCPServerParameter {
  name: string;
  type: MCPArgType | MCPEnvType;
  description: string;
}

export interface IMCPConfig {
  servers?: IMCPServer[]; // Deprecated
  mcpServers: {
    [key: string]: IMCPServer;
  };
  updated?: number;
}
