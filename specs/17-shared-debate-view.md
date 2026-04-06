# Component: Shared Debate View (Public)

## Overview
Public, read-only view of a completed debate accessible via a shareable URL. No authentication required. Renders the full debate with all turns.

## What It Does
- Fetches a completed debate by ID from the public API endpoint
- Renders all turns in a read-only message list
- Shows debate metadata (topic, agent info, turn count)
- Handles non-existent or non-completed debates with a 404-style message

## Files to Create
- `frontend/app/shared/[id]/page.tsx` — shared debate page

## Dependencies
- Component `09-frontend-setup` (types, shadcn/ui)
- Component `10-api-client-sse` (`getSharedDebate` API method)
- Component `15-debate-view` (reuses `DebateMessage` component)

## Page Logic

### On Mount
1. Extract `id` from URL params
2. Call `getSharedDebate(id)` — this calls `GET /api/v1/debates/{id}` without auth
3. If 200: render the debate
4. If 404: show "Debate not found" or "This debate is not yet available for sharing"

## Layout

```
┌──────────────────────────────────────────────────────┐
│  AI Debate Arena                                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  "Should AI be regulated by governments?"            │
│  100 turns • Completed Apr 5, 2026                   │
│  Pro Regulation (GPT-4.1) vs Anti Regulation (Sonnet)│
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  [Agent A message - Turn 0]                  │    │
│  │  [Agent B message - Turn 1]                  │    │
│  │  [Agent A message - Turn 2]                  │    │
│  │  ...                                         │    │
│  │  [Agent B message - Turn 99]                 │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ── Shared from AI Debate Arena ──                   │
│  [Create your own debate →]                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Behavior & Constraints
- No auth required — this is a public page
- Only completed debates are viewable (backend enforces this)
- All messages render immediately (no streaming — all turns are pre-existing)
- Reuses `DebateMessage` component from the debate view
- The page is SEO-friendly: use Next.js metadata for title/description from the debate topic
- A CTA at the bottom links to the landing page or signup
- No sidebar, no header user menu — standalone page with minimal chrome
- If the debate doesn't exist or isn't completed: friendly 404 message, not a raw error

## Metadata (SEO)
```typescript
export async function generateMetadata({ params }) {
  const debate = await getSharedDebate(params.id);
  return {
    title: `AI Debate: ${debate.topic} | AI Debate Arena`,
    description: `Watch two AI agents debate: "${debate.topic}" — ${debate.agent_a_config.name} vs ${debate.agent_b_config.name}`,
  };
}
```

## Relevant Skills
- `nextjs` — dynamic metadata, server components
- `react-markdown` — message content rendering
- `tailwindcss` — standalone page styling

### Recommended skills.sh Skills
- **next-best-practices** — Next.js server components, dynamic metadata generation, and SEO patterns
  ```bash
  npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
  ```
- **frontend-design** — distinctive page design with typography, color, and spatial composition for the standalone shared view
  ```bash
  npx skills add https://github.com/anthropics/skills --skill frontend-design
  ```

## Tests to Validate
- **Renders completed debate**: Shows topic, agents, and all messages
- **No auth required**: Page loads without any authentication
- **404 handling**: Non-existent debate shows friendly error message
- **Non-completed 404**: In-progress debate returns 404 from backend, shown as "not available"
- **Message rendering**: All turns display with correct styling (reuses DebateMessage)
- **SEO metadata**: Page title includes debate topic
- **CTA link**: Bottom of page links to landing/signup
- **No streaming**: All messages render immediately (no streaming state)
