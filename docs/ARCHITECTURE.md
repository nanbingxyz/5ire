# Architecture

Technical architecture documentation for 5ire, an Electron-based AI assistant with MCP integration and local knowledge base capabilities.

## High-Level Architecture

5ire is built on Electron's dual-process architecture, separating system-level operations from the user interface.

### Process Model

**Main Process (Node.js)**
- Manages application lifecycle and native system APIs
- Handles file I/O, SQLite database operations, and document processing
- Runs MCP servers and manages their lifecycle
- Executes Python-based embedding model for knowledge base
- Processes IPC requests from renderer

**Renderer Process (Chromium + React)**
- Runs the React/TypeScript UI application
- Manages application state with Zustand stores
- Communicates with main process via IPC bridge
- Handles user interactions and real-time streaming responses

**Preload Scripts**
- Secure bridge between main and renderer processes
- Exposes controlled IPC channels to renderer
- Prevents direct Node.js access from renderer for security

### Application Layers

```
┌─────────────────────────────────────┐
│     Presentation Layer (React)      │
│  Components, Pages, State Stores    │
└─────────────────────────────────────┘
              ↕ IPC
┌─────────────────────────────────────┐
│      Service Layer (Main)           │
│  Chat Services, MCP Client, RAG     │
└─────────────────────────────────────┘
              ↕
┌─────────────────────────────────────┐
│       Data Layer                    │
│  SQLite, File System, Vector Store  │
└─────────────────────────────────────┘
              ↕
┌─────────────────────────────────────┐
│    Integration Layer                │
│  AI Provider APIs, MCP Servers      │
└─────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Fluent UI** component library for consistent design
- **SCSS** for styling with CSS modules
- **Zustand** for lightweight state management
- **i18next** for internationalization

### Backend (Main Process)
- **Electron** for cross-platform desktop capabilities
- **Node.js** runtime environment
- **SQLite** (better-sqlite3) for local data persistence
- **Python** integration via child processes for ML models

### Key Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `mammoth`, `xlsx`, `pdf-parse` - Document parsing libraries
- `markdown-it` - Markdown rendering with custom plugins
- `electron-store` - Persistent configuration storage
- `electron-updater` - Auto-update functionality

## Directory Structure

```
src/
├── main/              # Electron main process
│   ├── main.ts        # Application entry point
│   ├── mcp.ts         # MCP server management
│   ├── knowledge.ts   # Knowledge base operations
│   ├── embedder.ts    # Embedding model interface
│   ├── sqlite.ts      # Database operations
│   └── docloader.ts   # Document loading utilities
├── renderer/          # React application
│   ├── App.tsx        # Root component
│   ├── pages/         # Page components
│   ├── components/    # Reusable UI components
│   └── stores/        # Zustand state stores
├── intellichat/       # AI chat implementation
│   ├── services/      # Provider-specific chat services
│   └── readers/       # Stream response readers
├── providers/         # AI provider configurations
├── types/             # TypeScript type definitions
├── utils/             # Shared utilities
└── hooks/             # React custom hooks
```

## Core Components

### Chat System

The chat system uses an abstract service pattern to support multiple AI providers through a unified interface.

**IChatService Interface**
```typescript
interface IChatService {
  context: IChatContext;
  provider: IServiceProvider;
  apiSettings: { base: string; key: string; model: string };
  
  chat({ message, onMessage, onComplete, onError }): void;
  abort(): void;
  isReady(): boolean;
}
```

Each provider (OpenAI, Anthropic, Google, etc.) implements this interface with provider-specific logic for:
- Request formatting
- Streaming response handling
- Error management
- Token counting

**Chat Readers**
Stream readers parse provider-specific response formats (SSE, JSON streams) and normalize them into a consistent message format for the UI.

**Context Management**
- System prompts define AI behavior
- Conversation history maintains context
- Knowledge base integration injects relevant documents
- MCP tools provide additional capabilities

### MCP Integration

The Model Context Protocol (MCP) enables standardized tool integration.

**MCP Client (`src/main/mcp.ts`)**
- Manages connections to multiple MCP servers
- Supports both local (stdio) and remote (HTTP/SSE) servers
- Handles server lifecycle (activation, deactivation, reconnection)
- Implements timeout and retry logic for reliability

**Transport Types**
- `StdioClientTransport` - Local servers via stdin/stdout
- `SSEClientTransport` - Remote servers via Server-Sent Events
- `StreamableHTTPClientTransport` - Remote servers via HTTP streaming

**Tool Discovery and Execution**
1. Client connects to MCP server on activation
2. Server capabilities are queried (tools, prompts, resources)
3. Tools are listed and made available to AI models
4. AI requests tool execution during conversation
5. Tool calls are validated against approval policy
6. Results are returned to AI for continued processing

**Configuration**
MCP servers are configured in `mcp.json` with:
- Command and arguments for local servers
- URL and headers for remote servers
- Environment variables and proxy settings
- Activation state and capabilities

### Knowledge Base (RAG)

The knowledge base implements Retrieval-Augmented Generation using local embeddings.

**Document Processing Pipeline**
1. User selects documents (docx, xlsx, pptx, pdf, txt, csv)
2. Documents are parsed into text chunks
3. Chunks are embedded using local bge-m3 model
4. Embeddings are stored in SQLite with metadata
5. Documents are organized into collections

**Embedding Service (`src/main/embedder.ts`)**
- Runs local bge-m3 model via Python subprocess
- Supports multilingual text (90+ languages)
- Generates 1024-dimensional embeddings
- Processes documents in batches for efficiency

**Retrieval Process**
1. User message is embedded using same model
2. Vector similarity search finds relevant chunks
3. Top-k chunks are retrieved with metadata
4. Context is injected into chat prompt
5. AI generates response with retrieved knowledge

**Storage**
- Document metadata in SQLite
- Embeddings stored as binary blobs
- Collections organize related documents
- Chunk references maintain document structure

### Provider System

The provider system abstracts differences between AI providers.

**Provider Configuration**
Each provider defines:
- API endpoints and authentication
- Supported models and capabilities
- Request/response formats
- Token limits and pricing

**Capability Detection**
- Vision support (image inputs)
- Tool calling (function execution)
- Streaming responses
- JSON mode
- System prompts

**Model Management**
- Users configure API keys per provider
- Models are selected per conversation
- Settings include temperature, max tokens, etc.
- Usage is tracked per provider and model

## Data Flow

### Chat Message Flow

```
User Input (Editor)
    ↓
IPC: chat-message
    ↓
Chat Service (Main Process)
    ↓
Prepare Request:
  - Load conversation context
  - Inject knowledge if enabled
  - Add available MCP tools
    ↓
HTTP Request to AI Provider
    ↓
Stream Response via Reader
    ↓
IPC: stream-data events
    ↓
UI Update (Real-time)
    ↓
Save to SQLite
    ↓
Update Usage Statistics
```

### Knowledge Base Query Flow

```
User Message
    ↓
Check if knowledge enabled
    ↓
Embed message (Python subprocess)
    ↓
Vector similarity search (SQLite)
    ↓
Retrieve top-k chunks
    ↓
Format as context
    ↓
Inject into system prompt
    ↓
Send to AI provider
    ↓
AI generates response with context
```

### MCP Tool Execution Flow

```
AI requests tool execution
    ↓
Parse tool call from response
    ↓
Check approval policy
  - Auto: execute immediately
  - Manual: request user approval
    ↓
IPC: mcp-call-tool
    ↓
MCP Client routes to server
    ↓
Server executes tool
    ↓
Result returned to client
    ↓
Result sent back to AI
    ↓
AI continues with tool result
```

## Key Subsystems

### IPC Communication

Extensive IPC handlers in `src/main/main.ts` enable renderer-main communication:

- `request` - Generic HTTP requests with proxy support
- `mcp-*` - MCP server management and tool execution
- `knowledge-*` - Document import and search
- `encrypt/decrypt` - Secure credential storage
- `get-store/set-store` - Persistent settings

### Authentication & Sync

Optional Supabase integration provides:
- User account management
- Settings backup across devices
- OAuth authentication flow
- Offline-first design (works without account)

### Analytics

Usage tracking system monitors:
- API calls per provider and model
- Token consumption and costs
- Feature usage patterns
- Optional telemetry via Axiom

### Settings Management

Electron-store persists user preferences:
- Appearance (theme, language)
- Provider API keys and models
- MCP server configurations
- Knowledge base settings
- Chat preferences

## Architecture Decisions

### Why Electron?
- Cross-platform desktop application (Windows, macOS, Linux)
- Access to native APIs (file system, system info)
- Ability to run local Python models for embeddings
- Rich UI with web technologies
- Offline-capable with local data storage

### Why Local Embeddings?
- **Privacy**: Documents never leave the device
- **Offline**: No internet required for knowledge base
- **Cost**: No API fees for embeddings
- **Multilingual**: bge-m3 supports 90+ languages
- **Control**: Full control over embedding process

### Why MCP?
- **Standardization**: Open protocol for tool integration
- **Extensibility**: Add tools without modifying core code
- **Community**: Growing ecosystem of MCP servers
- **Security**: Controlled execution with approval policies
- **Flexibility**: Support both local and remote tools

### Why Multiple Providers?
- **Choice**: Users select preferred AI provider
- **Fallback**: Switch providers if one is unavailable
- **Cost**: Optimize spending across providers
- **Capabilities**: Access different model strengths (vision, reasoning, speed)

### Why SQLite?
- **Embedded**: No separate database server required
- **Fast**: Efficient for local queries
- **Reliable**: ACID transactions
- **Portable**: Single file database
- **Vector Support**: Store embeddings as blobs

## Security Considerations

- Preload scripts limit renderer access to Node.js APIs
- API keys encrypted at rest using system keychain
- External URLs validated before opening
- MCP tool execution requires approval policies
- Certificate validation for HTTPS requests
- Proxy support for corporate environments

## Performance Optimizations

- Streaming responses for real-time feedback
- Batch embedding generation for documents
- SQLite indexes on frequently queried fields
- Lazy loading of UI components
- Debounced search and input handlers
- Connection pooling for MCP servers