# Terminal Startup Arguments - Implementation Summary

## Overview

This implementation adds support for terminal startup arguments that allow users to automatically create chats with pre-configured settings when launching the 5ire application.

## Architecture

### 1. CLI Argument Parser (`src/main/cli-args.ts`)

A dedicated module that parses command-line arguments and extracts chat configuration:

- **Supported Formats:**
  - Individual flags: `--new-chat --provider openai --model gpt-4 --system "..." --summary "..." --prompt "..." --temperature 0.7`
  - JSON format: `--chat '{"provider":"openai","model":"gpt-4",...}'`

- **Key Features:**
  - Provider derivation from model format (`Provider:model`)
  - Model normalization (always removes provider prefix)
  - Explicit provider takes precedence
  - Robust error handling for invalid JSON

### 2. Main Process Integration (`src/main/main.ts`)

Enhanced the main process to handle startup arguments:

- **Cold Start:** Parses `process.argv` when app launches
- **Second Instance:** Parses command line from second instance activation
- **Pending State:** Stores pending startup args until renderer is ready
- **IPC Communication:** Sends startup payload via `startup-new-chat` event

**Key Changes:**
```typescript
// Added variable to track pending startup args
let pendingStartupArgs: StartupChatArgs | null = null;

// Parse args on cold start
handleStartupArgs(process.argv);

// Parse args on second instance
app.on('second-instance', (event, commandLine) => {
  handleStartupArgs(commandLine);
  // ... handle deep links
});

// Send pending args when renderer is ready
ipcMain.on('install-tool-listener-ready', () => {
  if (pendingStartupArgs !== null) {
    mainWindow?.webContents.send('startup-new-chat', pendingStartupArgs);
    pendingStartupArgs = null;
  }
});
```

### 3. Preload API (`src/main/preload.ts`)

Exposed secure API for renderer process via contextBridge:

```typescript
startup: {
  onNewChat(callback: (args: StartupChatArgs) => void) {
    // Returns unsubscribe function
    return () => { ... };
  }
}
```

**Security Constraints:**
- Uses contextBridge for secure IPC communication
- No direct access to Node.js APIs from renderer
- Type-safe API with TypeScript interfaces

### 4. Renderer Handler (`src/renderer/components/StartupHandler.tsx`)

React component that handles startup events:

- **Placement:** Inside Router in FluentApp component
- **Lifecycle:** Sets up listener on mount, cleans up on unmount
- **Race Condition Protection:** Uses ref to prevent concurrent chat creation
- **Chat Creation:** Calls `useChatStore().createChat()` with parsed args
- **Navigation:** Automatically navigates to newly created chat

**Key Features:**
```typescript
- Prevents race conditions with isProcessingRef
- Proper error handling and logging
- Automatic navigation to created chat
- Clean event listener cleanup
```

## Data Flow

```
CLI Args → parseStartupArgs() → handleStartupArgs() → IPC Event
                                                          ↓
                                                    Preload API
                                                          ↓
                                                   StartupHandler
                                                          ↓
                                                  createChat() + navigate()
```

### Cold Start Flow:
1. User launches app with CLI args
2. Main process parses args from `process.argv`
3. Args stored in `pendingStartupArgs`
4. Renderer loads and sends 'install-tool-listener-ready'
5. Main sends 'startup-new-chat' event with args
6. StartupHandler receives event, creates chat, navigates

### Second Instance Flow:
1. User launches app again with CLI args (app already running)
2. Second instance detected, window focused
3. Main process parses args from `commandLine`
4. If renderer ready, immediately sends 'startup-new-chat' event
5. StartupHandler receives event, creates chat, navigates

## Testing

Comprehensive test suite in `test/main/cli-args.spec.ts`:

- ✅ Null handling for no args
- ✅ Individual flag parsing
- ✅ Partial flag parsing
- ✅ JSON format parsing
- ✅ Provider derivation from model
- ✅ Model normalization with explicit provider
- ✅ Invalid JSON handling
- ✅ Missing value handling
- ✅ Temperature number parsing
- ✅ Invalid temperature handling
- ✅ Complex JSON with all properties
- ✅ Provider derivation in JSON format

## Documentation

Complete user documentation in `docs/CLI_ARGUMENTS.md`:

- Usage examples for all scenarios
- Detailed explanation of provider derivation
- Behavior notes and edge cases
- Platform-specific considerations

## Edge Cases Handled

1. **Empty Args:** Returns null, no chat created
2. **Invalid JSON:** Logged and ignored, returns null
3. **Missing Values:** Ignores flag if no value provided
4. **Invalid Temperature:** Ignores if not a number
5. **Race Conditions:** Protected with ref guard in handler
6. **Deep Link Conflicts:** Searches all args, not just last one
7. **Provider Prefix:** Always normalized in model string
8. **Concurrent Events:** Processing flag prevents duplicate chat creation

## Future Enhancements

Potential improvements for future consideration:

1. Support for additional chat settings (maxTokens, maxCtxMessages)
2. Validate provider and model against available providers
3. Auto-send message if prompt is provided
4. Support for chat folder assignment
5. Batch chat creation from config file
6. Shell auto-completion for flags

## Breaking Changes

None. This is a new feature with no impact on existing functionality.

## Security Considerations

- ✅ All IPC communication through contextBridge
- ✅ No direct Node.js access from renderer
- ✅ Input validation in parser (JSON.parse in try-catch)
- ✅ Type-safe interfaces throughout
- ✅ No eval or code execution from user input
- ✅ Proper logging instead of console methods

## Performance Impact

Minimal:

- Argument parsing is O(n) where n = number of args (typically < 20)
- Event listeners cleaned up properly
- No memory leaks from event subscriptions
- Race condition protection prevents duplicate work
