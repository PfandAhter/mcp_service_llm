# LLM API Boilerplate

A NestJS boilerplate for building applications with LLM (Large Language Model) integrations. Provides a clean abstraction layer for multiple LLM providers with support for tool/function calling.

## Features

- 🔌 **Provider Abstraction** - Switch between Gemini, OpenAI easily
- 🛠️ **Tool/Function Calling** - Extensible tool registry with dynamic registration
- 🔄 **Recursive Tool Loop** - Handles multi-turn tool conversations automatically
- 📡 **Real-time Chat** - WebSocket gateway for streaming interactions
- 🌐 **Simple HTTP API** - Just send `sessionId` + `message`
- 💾 **Session Cache** - In-memory history management (DB-ready)
- 🧩 **Modular Design** - Easy to extend and customize

## Quick Start

### 1. Install Dependencies

```bash
cd llm-api-boilerplate
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key  # Optional
PORT=3000
```

### 3. Start the Server

```bash
npm run start:dev
```

### 4. Test

**HTTP (Simplified - just sessionId and message!):**
```bash
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-123",
    "message": "What time is it?"
  }'
```

**Response:**
```json
{
  "success": true,
  "sessionId": "user-123",
  "response": {
    "text": "The current time is 10:30 AM UTC.",
    "toolCalls": []
  }
}
```

**WebSocket:**
```javascript
const socket = io('http://localhost:3000/chat', {
  query: { sessionId: 'user-123' }
});

socket.on('ai_message', (data) => console.log('AI:', data.text));
socket.emit('message', { text: 'Hello!' });
```

**Session Management:**
```bash
# Get session info
curl http://localhost:3000/chat/session/user-123

# Delete session (clear history)
curl -X DELETE http://localhost:3000/chat/session/user-123
```

---

## Project Structure

```
src/
├── libs/
│   └── llm/
│       ├── interfaces/
│       │   ├── llm.types.ts           # Provider-agnostic types
│       │   └── chat-history.types.ts  # History manager interface
│       ├── history/
│       │   ├── gemini-history.manager.ts  # Gemini history format
│       │   ├── openai-history.manager.ts  # OpenAI history format
│       │   └── index.ts
│       └── providers/
│           ├── base-llm.provider.ts   # Abstract base class
│           ├── gemini.provider.ts     # Google Gemini
│           └── openai.provider.ts     # OpenAI GPT
├── modules/
│   ├── llm/
│   │   ├── services/
│   │   │   ├── llm-factory.service.ts    # Provider factory
│   │   │   ├── tool-handler.service.ts   # Tool registry & execution
│   │   │   └── orchestrator.service.ts   # Conversation loop
│   │   └── llm.module.ts
│   └── chat/
│       ├── chat.gateway.ts     # WebSocket handler
│       ├── chat.controller.ts  # HTTP endpoints
│       └── chat.module.ts
├── app.module.ts
└── main.ts
```

---

## Provider-Aware History Management

Different LLM providers handle tool calls differently. This boilerplate includes **provider-specific history managers** that correctly format tool calls and results.

### Why This Matters

**Gemini** (following [official docs](https://ai.google.dev/gemini-api/docs/function-calling)):
```javascript
// Tool results are sent as USER role with functionResponse
contents.push(response.candidates[0].content);  // Model's tool call
contents.push({ role: 'user', parts: [{ functionResponse: { name, response } }] });
```

**OpenAI**:
```javascript
// Tool results are sent as TOOL role with tool_call_id
messages.push({ role: 'assistant', tool_calls: [...] });  // Model's tool call
messages.push({ role: 'tool', tool_call_id: '...', content: '...' });
```

### Using History Managers Directly

```typescript
import { getHistoryManager } from 'src/libs/llm/history';

const historyManager = getHistoryManager('gemini'); // or 'openai'

// Build history in provider-native format
let history = [];
history = historyManager.addUserMessage(history, 'Hello');
history = historyManager.addAssistantToolCalls(history, toolCalls, rawResponse);
history = historyManager.addToolResults(history, toolCall, result);

// Use with provider
const response = await provider.generateWithNativeHistory(history, systemPrompt, tools);
```

---

## Registering Custom Tools

Tools allow the LLM to perform actions. Register them in your service:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ToolHandlerService } from './modules/llm';

@Injectable()
export class MyToolsService implements OnModuleInit {
  constructor(private toolHandler: ToolHandlerService) {}

  onModuleInit() {
    // Register a weather tool
    this.toolHandler.registerTool(
      {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' }
          },
          required: ['location']
        }
      },
      async (toolCall, context) => {
        const { location } = toolCall.args;
        // Call your weather API here
        return {
          success: true,
          message: `Weather for ${location}: Sunny, 25°C`,
          data: { location, temp: 25, condition: 'sunny' }
        };
      }
    );
  }
}
```

---

## Adding a New LLM Provider

1. Extend `BaseLLMProvider`:

```typescript
// src/libs/llm/providers/anthropic.provider.ts
import { BaseLLMProvider } from './base-llm.provider';
import { LLMMessage, LLMResponse, ToolDefinition } from '../interfaces/llm.types';

export class AnthropicProvider extends BaseLLMProvider {
  async generateResponse(
    messages: LLMMessage[],
    systemPrompt?: string,
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    // Implement Claude API call here
  }
}
```

2. Register in `LLMFactoryService`:

```typescript
case 'anthropic': {
  const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
  return new AnthropicProvider(providerConfig, apiKey);
}
```

---

## MCP Integration

To connect to MCP (Model Context Protocol) servers:

1. Create an MCP client service
2. Register MCP tools dynamically via `ToolHandlerService`
3. Forward tool calls to MCP servers

Example structure:

```typescript
@Injectable()
export class MCPClientService implements OnModuleInit {
  constructor(private toolHandler: ToolHandlerService) {}

  async onModuleInit() {
    // Connect to MCP server
    const mcpTools = await this.discoverMCPTools();
    
    // Register each MCP tool
    for (const tool of mcpTools) {
      this.toolHandler.registerTool(tool.definition, async (call, ctx) => {
        return this.executeOnMCPServer(tool.name, call.args);
      });
    }
  }
}
```

---

## API Reference

### HTTP Endpoints

#### POST /chat/message

Send a message and get a response.

**Request:**
```json
{
  "message": "Hello!",
  "sessionId": "optional-session-id",
  "llmConfig": {
    "provider": "gemini",
    "model": "gemini-2.0-flash-exp",
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 2048
    }
  },
  "systemPrompt": "You are a helpful assistant.",
  "history": []
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-123",
  "response": {
    "text": "Hello! How can I help you today?",
    "toolCalls": []
  },
  "usage": {
    "inputTokens": 10,
    "outputTokens": 15,
    "totalTokens": 25
  }
}
```

### WebSocket Events

**Namespace:** `/chat`

| Direction | Event | Payload |
|-----------|-------|---------|
| → Server | `message` | `{ text: string, history?: [] }` |
| → Server | `configure` | `{ llmConfig?, systemPrompt?, context? }` |
| → Server | `end_session` | - |
| ← Client | `connected` | `{ sessionId, clientId }` |
| ← Client | `ai_message` | `{ text, timestamp }` |
| ← Client | `tool_executed` | `{ toolName, success, message }` |
| ← Client | `error` | `{ code, message, details? }` |

---

## License

MIT
