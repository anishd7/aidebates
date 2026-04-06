# Component: API Keys Store

## Overview
Zustand store that caches decrypted API keys in memory. Keys are fetched once per session from `GET /api/v1/keys/decrypt` and held in React state (never localStorage) for use in debate turn requests.

## What It Does
- Fetches and caches decrypted API keys on session start
- Provides keys to the DebateManager for `X-OpenAI-Key` / `X-Anthropic-Key` headers
- Tracks which providers have configured keys (for UI validation)
- Re-fetches keys when the user updates them in Settings

## Files to Create
- `frontend/stores/apiKeys.ts`

## Dependencies
- Component `10-api-client-sse` (`decryptKeys`, `listKeys` API methods)
- Component `09-frontend-setup` (types)

## State Shape

```typescript
interface ApiKeysState {
  // Decrypted keys (sensitive, in-memory only)
  keys: {
    openai?: string;
    anthropic?: string;
  };

  // Provider metadata (non-sensitive, for UI)
  configured: {
    openai?: { key_last_four: string; updated_at: string };
    anthropic?: { key_last_four: string; updated_at: string };
  };

  isLoaded: boolean;
  isLoading: boolean;

  // Actions
  fetchKeys: () => Promise<void>;
  refreshKeys: () => Promise<void>;
  hasKey: (provider: string) => boolean;
  clearKeys: () => void;
}
```

## Actions

### `fetchKeys()`
1. Set `isLoading = true`
2. Call `GET /api/v1/keys` to get provider metadata (last four, timestamps)
3. Call `GET /api/v1/keys/decrypt` to get full decrypted keys
4. Store both in state
5. Set `isLoaded = true`, `isLoading = false`

### `refreshKeys()`
Same as `fetchKeys()` — called after user adds/updates/deletes a key in Settings.

### `hasKey(provider: string) -> boolean`
Returns true if a key exists for the given provider.

### `clearKeys()`
Clears all cached keys from state. Called on sign-out.

## Behavior & Constraints
- Keys are NEVER stored in localStorage, sessionStorage, cookies, or any persistent client storage
- Keys exist only in JavaScript memory (Zustand store) and are lost on page refresh
- On page load (after auth), `fetchKeys()` is called to populate the cache
- The `configured` map is used by the UI to show which providers are set up (without exposing keys)
- `keys` map is only read by the DebateManager when making next-turn requests
- On sign-out, `clearKeys()` must be called to wipe sensitive data from memory

## Relevant Skills
- `zustand` — Zustand store with async actions
- `typescript` — typed state management

### Recommended skills.sh Skills
- **vercel-react-best-practices** — React performance patterns including SWR for request deduplication and optimized state management
  ```bash
  npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
  ```

## Tests to Validate
- **Fetch keys**: `fetchKeys` populates both `keys` and `configured` state
- **Has key**: `hasKey('openai')` returns true after fetching a key, false before
- **Clear keys**: After `clearKeys()`, both `keys` and `configured` are empty
- **Refresh**: `refreshKeys` updates state with latest from backend
- **Loading state**: `isLoading` is true during fetch, false after
- **No persistence**: Keys are not written to localStorage or sessionStorage
