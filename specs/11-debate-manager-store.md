# Component: Debate Manager (Zustand Store)

## Overview
Client-side Zustand store that manages the debate loop — calling `POST /next-turn` repeatedly, consuming SSE streams, and maintaining in-memory state for all active debates. This is the heartbeat of the frontend.

## What It Does
- Manages multiple concurrent debate loops (one per active debate)
- Drives the turn-by-turn loop: call next-turn → read SSE stream → update state → repeat
- Maintains per-debate message lists, streaming state, and error state
- Supports start, resume, and pause operations
- Handles all SSE event types (turn_start, token, turn_complete, error)

## Files to Create
- `frontend/stores/debateManager.ts`

## Dependencies
- Component `10-api-client-sse` (`fetchNextTurn`, `parseSSEEvents`)
- Component `12-api-keys-store` (for cached API keys)
- Component `09-frontend-setup` (for types, auth token)

## State Shape

```typescript
interface DebateMessage {
  turnNumber: number;
  agentName: string;
  agentSide: 'a' | 'b';
  content: string;
  isStreaming: boolean;  // true while tokens are arriving
}

interface ActiveDebate {
  debateId: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  messages: DebateMessage[];
  currentTurn: number;
  maxTurns: number;
  error?: { code: string; message: string; recoverable: boolean };
  abortController: AbortController;
}

interface DebateManagerState {
  activeDebates: Record<string, ActiveDebate>;

  // Actions
  startDebate: (debateId: string, maxTurns: number) => void;
  resumeDebate: (debateId: string, existingTurns: Turn[], maxTurns: number) => void;
  pauseDebate: (debateId: string) => void;
  getDebate: (debateId: string) => ActiveDebate | undefined;
  clearDebate: (debateId: string) => void;
}
```

## Loop Logic (`runDebateLoop`)

```
async function runDebateLoop(debateId, apiKeys, signal):
  while (!signal.aborted):
    response = await fetchNextTurn(debateId, apiKeys, signal)

    if response.status === 204:
      → mark debate as 'completed', break

    if response.status === 409:
      → retry immediately (another tab claimed the turn), continue

    if response.status >= 400:
      → parse error JSON, set debate error state, break

    reader = response.body.getReader()
    buffer = ''

    while true:
      { done, value } = await reader.read()
      if done: break

      buffer += decode(value)
      { parsed, remaining } = parseSSEEvents(buffer)
      buffer = remaining

      for each event in parsed:
        switch event.event:
          'turn_start':  → add new streaming message to state
          'token':       → append text to current streaming message
          'turn_complete': → finalize message (isStreaming=false), update currentTurn
          'error':       → set debate error state

    if debate is completed or errored: break

  catch AbortError:
    → user paused, not an error, break
  catch other:
    → set network error, break
```

## Actions

### `startDebate(debateId, maxTurns)`
1. Create a new `AbortController`
2. Initialize `ActiveDebate` with empty messages, status='running'
3. Start `runDebateLoop` (fire-and-forget async)

### `resumeDebate(debateId, existingTurns, maxTurns)`
1. Create a new `AbortController`
2. Initialize `ActiveDebate` with `existingTurns` converted to `DebateMessage[]` (all `isStreaming: false`)
3. Set `currentTurn` to `existingTurns.length`
4. Start `runDebateLoop`

### `pauseDebate(debateId)`
1. Call `abortController.abort()` for the debate
2. Set status to 'paused'
3. Backend sets debate to 'paused' on its side (if mid-turn, the turn is lost and retryable)

### `getDebate(debateId)`
Returns the `ActiveDebate` for the given ID, or undefined.

### `clearDebate(debateId)`
Remove the debate from `activeDebates` (used when navigating away permanently).

## State Update Patterns

### On `turn_start` event
```typescript
messages.push({
  turnNumber: event.data.turn,
  agentName: event.data.agent_name,
  agentSide: event.data.agent_side,
  content: '',
  isStreaming: true,
});
```

### On `token` event
```typescript
// Append to the last message's content
const lastMsg = messages[messages.length - 1];
lastMsg.content += event.data.text;
```

### On `turn_complete` event
```typescript
const lastMsg = messages[messages.length - 1];
lastMsg.content = event.data.content;  // canonical version from server
lastMsg.isStreaming = false;
currentTurn = event.data.current_turn;
if (event.data.debate_status === 'completed') status = 'completed';
```

### On `error` event
```typescript
status = 'error';
error = { code: event.data.code, message: event.data.message, recoverable: event.data.recoverable };
```

## Behavior & Constraints
- Multiple debates can run concurrently (each has its own AbortController and loop)
- The store persists in memory for the SPA lifetime — page refresh destroys all state
- On page refresh, debates are resumed via `resumeDebate` with turns loaded from the backend
- The loop is sequential: one turn at a time per debate (wait for SSE stream to finish before next call)
- Token updates should trigger React re-renders efficiently (Zustand selectors)
- The `abortController` is NOT serializable — Zustand's devtools may need to exclude it
- On 409 (conflict), retry immediately without incrementing any counters
- Network errors set the debate to error state with `recoverable: true`

## Relevant Skills
- `zustand` — Zustand store patterns, selectors, immer middleware (optional)
- `typescript` — async state management
- `react` — efficient re-rendering with streaming updates

### Recommended skills.sh Skills
- **vercel-react-best-practices** — React performance optimization covering efficient re-rendering, useTransition for loading states, and async patterns
  ```bash
  npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
  ```
- **typescript-advanced-types** — advanced TypeScript patterns for typed async state management
  ```bash
  npx skills add https://github.com/wshobson/agents --skill typescript-advanced-types
  ```

## Tests to Validate
- **Start debate**: `startDebate` creates an ActiveDebate with status='running' and empty messages
- **Resume debate**: `resumeDebate` initializes messages from existing turns
- **Pause debate**: `pauseDebate` aborts the controller and sets status='paused'
- **Token accumulation**: Sequential token events append to the last message's content
- **Turn complete**: Finalizes message with canonical content, updates currentTurn
- **Debate completion**: Status set to 'completed' when turn_complete has debate_status='completed'
- **Error handling**: Error event sets debate status and error object
- **Multiple debates**: Two debates can run independently in the store
- **409 retry**: Loop continues on 409 response (doesn't break)
- **Abort handling**: AbortError from pause does not set error state
- **Network error**: Fetch failure sets error with recoverable=true
