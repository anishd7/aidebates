# Component: Settings Page (API Key Management)

## Overview
Settings page where users manage their BYOK API keys for OpenAI and Anthropic. Allows adding, updating, and deleting keys.

## What It Does
- Displays configured API keys (provider name, last 4 chars, last updated)
- Allows adding a new key for a provider
- Allows updating an existing key
- Allows deleting a key
- Refreshes the in-memory key cache after changes

## Files to Create
- `frontend/app/(app)/settings/page.tsx` — settings page
- `frontend/components/settings/ApiKeyForm.tsx` — key entry/management form

## Dependencies
- Component `09-frontend-setup` (types, shadcn/ui)
- Component `10-api-client-sse` (`saveKey`, `listKeys`, `deleteKey` API methods)
- Component `12-api-keys-store` (`refreshKeys` action, `configured` state)
- shadcn/ui: `input`, `button`, `card`, `label`, `badge`
- `lucide-react` icons (Key, Trash2, Check, Eye, EyeOff)

## Layout

```
┌──────────────────────────────────────────────────────┐
│  Settings                                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  API Keys                                            │
│  Manage your API keys for AI model providers.        │
│  Keys are encrypted at rest and never shared.        │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  OpenAI                                        │  │
│  │  ✓ Configured  •  ****c123  •  Updated Apr 5  │  │
│  │  [Update Key]  [Delete]                        │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Anthropic                                     │  │
│  │  ○ Not configured                              │  │
│  │  [Add Key]                                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## ApiKeyForm Component

### States per provider
1. **Not configured**: Shows "Add Key" button
2. **Configured**: Shows last 4 chars, update date, "Update Key" and "Delete" buttons
3. **Editing**: Shows text input for key entry with "Save" and "Cancel" buttons

### Add/Update Flow
1. User clicks "Add Key" or "Update Key"
2. Input field appears (type=password by default, toggle to show)
3. User pastes their API key
4. Clicks "Save" → calls `POST /api/v1/keys` with provider and key
5. On success:
   - Show success indicator
   - Call `apiKeysStore.refreshKeys()` to update in-memory cache
   - Return to configured state showing new last 4 chars
6. On error: show error message inline

### Delete Flow
1. User clicks "Delete"
2. Confirmation prompt: "Are you sure? Active debates using this key will fail."
3. On confirm: calls `DELETE /api/v1/keys/{provider}`
4. On success: call `apiKeysStore.refreshKeys()`, show "Not configured" state

## Behavior & Constraints
- API key input is `type="password"` by default with a show/hide toggle
- Keys are never displayed in full — only `****` + last 4 chars
- After saving, the input clears and the key is no longer visible
- The page loads configured key metadata on mount from `apiKeysStore.configured`
- Providers are displayed in a fixed order: OpenAI, then Anthropic
- Delete confirmation is important — active debates will fail without keys
- Success/error feedback should be inline (not toast), near the relevant form

## Relevant Skills
- `shadcn` — Card, Input, Button, Badge, Label
- `react` — form state management
- `tailwindcss` — layout and styling

### Recommended skills.sh Skills
- **shadcn** (official) — expert guidance for shadcn/ui components (Card, Input, Button, Badge, Label)
  ```bash
  npx skills add shadcn/ui/shadcn
  ```
- **vercel-react-best-practices** — React performance patterns for form state and conditional rendering
  ```bash
  npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
  ```

## Tests to Validate
- **Renders providers**: Page shows OpenAI and Anthropic sections
- **Not configured state**: Provider without key shows "Not configured" and "Add Key"
- **Configured state**: Provider with key shows last 4 chars and update date
- **Add key flow**: Clicking "Add Key" shows input, saving calls API
- **Update key flow**: Clicking "Update Key" shows input pre-focused
- **Delete key flow**: Delete with confirmation calls API and updates state
- **Password toggle**: Input type toggles between password and text
- **Success feedback**: After saving, shows success indicator
- **Error feedback**: API error shows inline error message
- **Key refresh**: After save/delete, `refreshKeys()` is called
- **Input clears**: After successful save, the key input is cleared
