import { IMCPConfig } from './types/mcp';

export default {
  servers: [
    {
      key: 'AppleNotes',
      command: 'uvx',
      description:
        'The server implements the ability to read and write to your Apple Notes. Require Python>=3.12.',
      args: ['apple-notes-mcp'],
      isActive: false,
      // Example proxy configuration - replace with your actual proxy URL
      proxy: 'http://localhost:8080',
    },
    {
      key: 'FileSystem',
      command: 'npx',
      description:
        'The server will only allow operations within directories specified via args',
      args: [
        '-y',
        '--prefer-offline',
        '@modelcontextprotocol/server-filesystem',
        '<dirs:list: directories you about to access>',
      ],
      isActive: false,
    },
    {
      key: 'HackerNews',
      command: 'uvx',
      description:
        'The server provides tools for fetching information from Hacker News',
      args: ['mcp-hn'],
      isActive: false,
    },
    {
      key: 'Git',
      command: 'uvx',
      description: 'Tools to read, search, and manipulate Git repositories',
      args: [
        'mcp-server-git',
        '--repository',
        '<repoPath:string:Git Repository Path>',
      ],
      isActive: false,
    },
    {
      key: 'MacOs',
      command: 'npx',
      description:
        'A Model Context Protocol server that provides macOS-specific system information and operations.',
      args: ['-y', '--prefer-offline', '@mcp-get-community/server-macos'],
      isActive: false,
    },
    {
      key: 'MySQL',
      command: 'npx',
      description:
        'An MCP server gives LLMs read - only access to MySQL databases for schema inspection and query execution.',
      args: ['-y', '--prefer-offline', '@benborla29/mcp-server-mysql'],
      env: {
        MYSQL_HOST: '<host:string:database host>',
        MYSQL_PORT: '<port:string:database port>',
        MYSQL_USER: '<user:string:database user>',
        MYSQL_PASS: '<pass:string:database password>',
        MYSQL_DB: '<db:string:database name>',
      },
      isActive: false,
    },
    {
      key: 'Obsidian',
      command: 'npx',
      description:
        'Read and search through your Obsidian vault or any directory containing Markdown notes.',
      args: [
        '-y',
        '--prefer-offline',
        'mcp-obsidian',
        '<vaultPath:string:Folder where md files are stored>',
      ],
      isActive: false,
    },
    {
      key: 'Postgres',
      command: 'npx',
      description: 'Read-only database access with schema inspection.',
      args: [
        '-y',
        '@modelcontextprotocol/server-postgres',
        '<connectionString:string:like postgresql://localhost/db>',
      ],
      isActive: false,
    },
    {
      key: 'Linear',
      command: 'npx',
      description: 'This server allowing LLMs to interact with Linear issues.',
      args: ['-y', '--prefer-offline', 'mcp-linear'],
      env: {
        LINEAR_API_KEY: '<apiKey:string:Get the api key from linear.app>',
      },
      isActive: false,
    },
    {
      key: 'Search1api',
      command: 'npx',
      description:
        'A Model Context Protocol (MCP) server that provides search and crawl functionality using Search1API.',
      args: ['-y', 'search1api-mcp'],
      env: {
        SEARCH1API_KEY:
          '<apiKey:string:Get the api key from www.search1api.com>',
      },
      isActive: false,
    },
    {
      key: 'Shell',
      command: 'npx',
      description:
        'A Node.js MCP implementation enables secure shell command execution for AI models.',
      args: ['-y', '--prefer-offline', 'mcp-shell'],
      isActive: false,
    },
    {
      key: 'Slack',
      command: 'npx',
      description:
        'MCP Server for the Slack API, enabling Claude to interact with Slack workspaces.',
      args: ['-y', '--prefer-offline', '@modelcontextprotocol/server-slack'],
      env: {
        SLACK_BOT_TOKEN: '<botToken:string:Your slack bot token>',
        SLACK_TEAM_ID: '<teamId:string:Your slack team id>',
      },
      isActive: false,
    },
    {
      key: 'Sqlite',
      command: 'uvx',
      description:
        'An MCP server using SQLite allows SQL querying, business data analysis, and automatic memo generation.',
      args: [
        'mcp-server-sqlite',
        '--db-path',
        '<dbPath:string: Sqlite database file path>',
      ],
      isActive: false,
    },
    {
      key: 'Tavily',
      command: 'npx',
      description: 'Tavily MCP Server',
      args: ['-y', 'tavily-mcp@0.1.2'],
      env: {
        TAVILY_API_KEY:
          '<apiKey:string:You can get the API key from https://tavily.com>',
      },
      isActive: false,
    },
    {
      key: 'Time',
      command: 'uvx',
      description:
        'A Model Context Protocol server providing tools for time queries and timezone conversions for LLMs',
      args: [
        'mcp-server-time',
        '--local-timezone=<timezone:string:like Asia/Shanghai. You may need install tzdata first>',
      ],
      isActive: false,
    },
    {
      key: 'SequentialThinking',
      command: 'npx',
      description:
        'An MCP server tool for dynamic problem-solving with structured thinking.',
      args: [
        '-y',
        '--prefer-offline',
        '@modelcontextprotocol/server-sequential-thinking',
      ],
      isActive: false,
    },
    {
      key: 'Web',
      command: 'uvx',
      description:
        'A Model Context Protocol server that provides web content fetching capabilities',
      args: ['mcp-server-fetch'],
      isActive: false,
    },
  ],
} as IMCPConfig;
