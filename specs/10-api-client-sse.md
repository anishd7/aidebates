# Component: Frontend API Client & SSE Parser

## Overview
Typed API client for communicating with the FastAPI backend, plus an SSE (Server-Sent Events) parser for handling streaming debate turns.

## What It Does
- Provides a typed fetch wrapper that handles auth headers, error responses, and JSON parsing
- Parses SSE event streams from the `next-turn` endpoint into structured events
- Handles API keys in request headers for turn generation

## Files to Create
- `frontend/lib/api.ts` — API client with typed methods
- `frontend/lib/sse.ts` — SSE stream parser utility

## Dependencies
- Component `09-frontend-setup` (for types, auth token access)

## API Client (`lib/api.ts`)

### Core Function
```typescript
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>
```
- Prepends `NEXT_PUBLIC_API_URL` to the path
- Adds `Authorization: Bearer <jwt>` header from NextAuth session
- Adds `Content-Type: application/json` for non-GET requests
- Throws typed errors for non-2xx responses

### Methods
| Method | Signature | Backend Endpoint |
|--------|-----------|------------------|
| `saveKey` | `(provider: string, apiKey: string) => Promise<KeyInfo>` | `POST /api/v1/keys` |
| `listKeys` | `() => Promise<KeyListResponse>` | `GET /api/v1/keys` |
| `decryptKeys` | `() => Promise<DecryptedKeysResponse>` | `GET /api/v1/keys/decrypt` |
| `deleteKey` | `(provider: string) => Promise<void>` | `DELETE /api/v1/keys/{provider}` |
| `createDebate` | `(data: CreateDebateRequest) => Promise<Debate>` | `POST /api/v1/debates` |
| `listDebates` | `(params?: ListParams) => Promise<DebateListResponse>` | `GET /api/v1/debates` |
| `getDebate` | `(id: string) => Promise<Debate>` | `GET /api/v1/debates/{id}` |
| `getSharedDebate` | `(id: string) => Promise<Debate>` | `GET /api/v1/debates/{id}` (no auth) |

### Next-Turn Request (SSE)
```typescript
function fetchNextTurn(debateId: string, apiKeys: ApiKeys, signal: AbortSignal): Promise<Response>
```
- `POST /api/v1/debates/{debateId}/next-turn`
- Sets `X-OpenAI-Key` and `X-Anthropic-Key` headers from `apiKeys`
- Returns the raw `Response` object for SSE reading
- Accepts an `AbortSignal` for cancellation

## SSE Parser (`lib/sse.ts`)

### Types
```typescript
interface SSEEvent {
  event: string;  // 'turn_start' | 'token' | 'turn_complete' | 'error'
  data: any;      // parsed JSON
}

interface ParseResult {
  parsed: SSEEvent[];
  remaining: string;  // unparsed buffer remainder
}
```

### `parseSSEEvents(buffer: string): ParseResult`
Parses a raw SSE text buffer into structured events:
1. Split buffer by newlines
2. Track current `event:` and `data:` fields
3. On empty line (event boundary), parse `data` as JSON and emit
4. Return unparsed remainder for the next chunk

### SSE Format Expected
```
event: turn_start
data: {"turn": 0, "agent_name": "Pro Regulation", "agent_side": "a", "model": "gpt-4.1"}

event: token
data: {"text": "I "}

event: turn_complete
data: {"turn": 0, "agent_name": "Pro Regulation", "content": "...", "debate_status": "running", "current_turn": 1}

event: error
data: {"code": "invalid_api_key", "provider": "openai", "message": "...", "recoverable": true}
```

## Behavior & Constraints
- The API client uses `getToken()` from NextAuth to get the JWT — this happens on every request
- All API responses are typed — the client handles JSON parsing and type casting
- Error responses (4xx/5xx) throw an error object with `status`, `code`, and `message`
- The SSE parser must handle partial chunks (incomplete events at buffer end)
- The SSE parser must handle the case where `data:` spans multiple lines (unlikely but spec-compliant)
- `fetchNextTurn` does NOT parse the SSE stream — it returns the Response for the DebateManager to consume
- API key headers are only set if the key exists (don't send empty string headers)

## Relevant Skills
- `nextjs` — client-side fetch patterns, NextAuth token access
- `typescript` — strict typing for API responses

### Recommended skills.sh Skills
- **next-best-practices** — Next.js data fetching patterns, route handler best practices, and bundling considerations
  ```bash
  npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
  ```
- **typescript-advanced-types** — advanced TypeScript type patterns for strict API client typing
  ```bash
  npx skills add https://github.com/wshobson/agents --skill typescript-advanced-types
  ```

## Tests to Validate
- **SSE parser**: Parses a complete event (event + data + blank line) correctly
- **SSE parser**: Handles multiple events in one buffer
- **SSE parser**: Returns unparsed remainder for incomplete events
- **SSE parser**: Handles JSON parsing of data fields
- **API client**: Includes Authorization header in requests
- **API client**: Handles 401 responses appropriately
- **API client**: Handles 400 responses with error body
- **Next-turn request**: Includes API key headers when keys are present
- **Next-turn request**: Does not include headers for missing keys
- **Abort**: fetchNextTurn respects AbortSignal
