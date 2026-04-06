# Component: Debate View & Streaming Messages

## Overview
The main debate display page — shows the debate topic, agent info, status, and a scrolling list of messages with real-time streaming text. Handles live debates, paused debates (with resume), and completed debate history.

## What It Does
- Displays debate metadata (topic, status, turn counter, agent info)
- Renders messages from both agents in a scrolling list
- Shows streaming text with a blinking cursor for the currently generating turn
- Auto-scrolls to bottom as new tokens arrive (with manual scroll override)
- Shows "Resume" button for paused debates
- Shows "Share" button for completed debates
- Loads debate history from the backend when navigating to a debate

## Files to Create
- `frontend/app/(app)/debate/[id]/page.tsx` — debate page
- `frontend/components/debate/DebateView.tsx` — main debate display
- `frontend/components/debate/DebateMessage.tsx` — single message bubble
- `frontend/components/debate/DebateStatus.tsx` — status badge/header
- `frontend/components/debate/StreamingText.tsx` — animated streaming text display

## Dependencies
- Component `09-frontend-setup` (types, shadcn/ui)
- Component `10-api-client-sse` (`getDebate` API method)
- Component `11-debate-manager-store` (for live message state)
- Component `12-api-keys-store` (for resume with keys)
- `react-markdown` for rendering message content
- shadcn/ui: `scroll-area`, `badge`, `button`, `tooltip`, `separator`
- `lucide-react` icons

## Page Logic (`debate/[id]/page.tsx`)

### On Mount
1. Extract `id` from URL params
2. Check if debate exists in `debateManager.activeDebates[id]`
   - If yes: use in-memory state (live messages)
   - If no: call `GET /api/v1/debates/{id}` to load from backend
3. If loaded from backend:
   - If `status === 'running'` or `status === 'paused'`: show "Resume" button
   - If `status === 'completed'`: show read-only history
   - If `status === 'created'`: start the debate loop automatically

### On Resume
1. Call `debateManager.resumeDebate(id, turns, maxTurns)` with turns from backend
2. The loop picks up from `currentTurn`

## DebateView Component

### Header Section
```
┌─────────────────────────────────────────────────────┐
│  "Should AI be regulated by governments?"            │
│  ● Running  •  Turn 12/100                           │
│  Agent A: Pro Regulation (GPT-4.1) vs                │
│  Agent B: Anti Regulation (Claude Sonnet 4)          │
│  [Pause]                                             │
└─────────────────────────────────────────────────────┘
```

### Message List
- Scrollable container with all debate messages
- Messages alternate between Agent A and Agent B
- Visual distinction: different background colors and alignment

### Footer (conditional)
- **Paused**: "This debate is paused. [Resume]"
- **Error**: Error message with [Resume] if recoverable, or "This debate cannot continue" if not
- **Completed**: "Debate completed! [Share] [Copy Link]"

## DebateMessage Component

```
┌──────────────────────────────────────────┐
│  🤖 Pro Regulation (GPT-4.1)    Turn 3  │
├──────────────────────────────────────────┤
│                                          │
│  Markdown-rendered content...            │
│  - List items                            │
│  - **Bold text**                         │
│  █ (blinking cursor if streaming)        │
│                                          │
└──────────────────────────────────────────┘
```

### Props
```typescript
interface DebateMessageProps {
  message: DebateMessage;
  agentConfig: AgentConfig;  // for model name display
  turnNumber: number;
}
```

### Styling
- **Agent A**: `blue-50` background, `blue-700` agent name, left-aligned robot icon
- **Agent B**: `emerald-50` background, `emerald-700` agent name, left-aligned robot icon
- Agent name + model shown in header
- Turn number subtle, right-aligned
- Content rendered as markdown via `react-markdown`

## StreamingText Component
- Wraps message content
- When `isStreaming === true`: appends a blinking cursor (`█`) after the text
- Cursor is a `slate-400` block that pulses via CSS animation
- When `isStreaming === false`: renders plain markdown (no cursor)

## Auto-Scroll Behavior
1. Default: auto-scroll to bottom as new tokens arrive
2. If user manually scrolls up (away from bottom): pause auto-scroll
3. If user scrolls back to bottom (within ~50px threshold): resume auto-scroll
4. Implementation: track `scrollTop + clientHeight >= scrollHeight - threshold`

## Share Button (Completed Debates)
1. Generate URL: `{window.location.origin}/shared/{debate.id}`
2. Copy to clipboard via `navigator.clipboard.writeText()`
3. Show "Copied!" tooltip briefly

## Behavior & Constraints
- The page must handle two data sources: in-memory (DebateManager) and backend (API)
- When both exist (e.g., debate is in DebateManager AND loaded from API), prefer DebateManager state
- Messages should render efficiently — token-by-token updates must not cause full list re-renders
- Use `react-markdown` for content rendering (supports bold, italic, lists, code blocks)
- Auto-scroll should feel natural — not jarring when reading previous messages
- The "Pause" button calls `debateManager.pauseDebate(id)`
- Loading state: show skeleton/spinner while fetching debate from backend

## Relevant Skills
- `shadcn` — ScrollArea, Badge, Button, Tooltip
- `react` — efficient rendering with streaming updates, scroll behavior
- `react-markdown` — markdown rendering
- `tailwindcss` — message styling, animations (blinking cursor)
- `nextjs` — dynamic route params

### Recommended skills.sh Skills
- **shadcn** (official) — expert guidance for shadcn/ui components (ScrollArea, Badge, Button, Tooltip)
  ```bash
  npx skills add shadcn/ui/shadcn
  ```
- **vercel-react-best-practices** — React performance optimization for efficient streaming re-renders, useTransition, and resource hints
  ```bash
  npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
  ```
- **next-best-practices** — Next.js dynamic route params, Suspense boundaries, and error handling with error.tsx
  ```bash
  npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
  ```
- **frontend-design** — distinctive UI design with motion, animations (blinking cursor), and spatial composition
  ```bash
  npx skills add https://github.com/anthropics/skills --skill frontend-design
  ```

## Tests to Validate
- **Renders debate**: Shows topic, status, agent info, and messages
- **Message styling**: Agent A messages have blue background, Agent B have green
- **Streaming cursor**: Streaming messages show blinking cursor
- **Streaming finalize**: Cursor disappears when message is complete
- **Markdown rendering**: Bold, italic, lists render correctly in messages
- **Auto-scroll**: New tokens scroll the view to bottom
- **Manual scroll override**: Scrolling up pauses auto-scroll
- **Resume button**: Shown for paused debates, triggers resume action
- **Share button**: Shown for completed debates, copies URL to clipboard
- **Error display**: Error state shows message and recoverable action
- **Loading state**: Shows loading indicator while fetching debate
- **Turn counter**: Displays current turn / max turns
- **History load**: Navigating to a completed debate loads all turns from API
