export type MCPServerType = 'local' | 'remote';
export type MCPServerCapability = 'tools' | 'prompts' | 'resources';
export type MCPServerApprovalPolicy = 'never' | 'always' | 'once';
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
  capabilities: MCPServerCapability[];
  approvalPolicy?: MCPServerApprovalPolicy;
  /**
   * Whether to allow inheriting system environment variables.
   * Controls if the subprocess can access system environment variables when executing local MCP commands.
   */
  allowSystemEnv?: boolean;
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

export interface IMCPPromptArgument {
  name: string;
  description?: string;
  required: boolean;
}

export interface IMCPPromptListItemData {
  name: string;
  description?: string;
  arguments?: IMCPPromptArgument[];
}

export interface IMCPPromptListItem {
  client: string;
  prompts: IMCPPromptListItemData[];
  error: string | null;
}

export interface IMCPPromptMessageContent {
  type: 'text' | 'image' | 'audio';
  text?: string;
  data?: string; // Base64
  mimeType?: string;
}

export interface IMCPPromptMessageItem {
  role: 'user' | 'assistant' | 'system';
  content: IMCPPromptMessageContent;
}

export interface IMCPPrompt {
  messages: IMCPPromptMessageItem[];
}
