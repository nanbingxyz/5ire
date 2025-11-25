# CLI Startup Arguments

5ire supports command-line arguments to automatically create chats with pre-configured settings when launching the application.

## Usage

### Individual Flags

You can use individual flags to configure a new chat:

```bash
5ire --new-chat --provider openai --model gpt-4 --system "You are a helpful assistant" --summary "My Chat" --prompt "Hello!" --temperature 0.7
```

#### Available Flags

- `--new-chat` - Flag to indicate creating a new chat (required when using individual flags)
- `--provider <provider>` - AI provider (e.g., openai, anthropic, google)
- `--model <model>` - Model name (e.g., gpt-4, claude-3-opus)
- `--system <message>` - System message for the chat
- `--summary <text>` - Summary/title for the chat
- `--prompt <text>` - Initial prompt/message to send
- `--temperature <number>` - Temperature setting (0.0 - 2.0)

### JSON Format

You can also provide all settings as a JSON object:

```bash
5ire --chat '{"provider":"openai","model":"gpt-4","system":"You are a helpful assistant","summary":"My Chat","prompt":"Hello!","temperature":0.7}'
```

### Provider Derivation

If you specify the model in the format `Provider:model`, the provider will be automatically derived:

```bash
5ire --new-chat --model anthropic:claude-3-opus
```

This is equivalent to:

```bash
5ire --new-chat --provider anthropic --model claude-3-opus
```

## Examples

### Basic Chat Creation

Create a new chat with OpenAI GPT-4:

```bash
5ire --new-chat --provider openai --model gpt-4
```

### Chat with System Message

Create a chat with a custom system message:

```bash
5ire --new-chat --provider anthropic --model claude-3-opus --system "You are a coding assistant specialized in TypeScript"
```

### Chat with Initial Prompt

Create a chat and send an initial message:

```bash
5ire --new-chat --provider openai --model gpt-4 --prompt "Explain quantum computing in simple terms"
```

### Complete Configuration

Create a fully configured chat:

```bash
5ire --new-chat \
  --provider openai \
  --model gpt-4 \
  --system "You are a creative writing assistant" \
  --summary "Story Writing Session" \
  --prompt "Write a short story about a time traveler" \
  --temperature 0.9
```

### Using JSON Format

```bash
5ire --chat '{
  "provider": "anthropic",
  "model": "claude-3-opus",
  "system": "You are a helpful assistant",
  "summary": "Quick Chat",
  "temperature": 0.7
}'
```

## Behavior

- When launched with startup arguments, 5ire will:
  1. Create a new chat with the specified configuration
  2. Navigate to the newly created chat
  3. If a `--prompt` is provided, it will be set as the initial input (but not automatically sent)

- On second instance activation (when 5ire is already running):
  - The existing window will be focused
  - A new chat will be created with the startup arguments
  - The user will be navigated to the new chat

## Notes

- The `--new-chat` flag is required when using individual flags (not needed with `--chat`)
- The `--chat` JSON format takes precedence over individual flags if both are provided
- Temperature values outside the valid range (typically 0.0-2.0) may be adjusted by the provider
- Invalid JSON in the `--chat` argument will be logged and ignored
- Provider derivation only works when the model contains a colon (`:`) separator
