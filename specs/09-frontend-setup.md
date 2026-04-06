# Component: Frontend Project Setup & Auth

## Overview
Next.js 14+ App Router project with Tailwind CSS, shadcn/ui, and NextAuth.js (Auth.js v5) with Google OAuth. This is the foundation for all frontend components.

## What It Does
- Initializes a Next.js project with TypeScript and App Router
- Configures Tailwind CSS and shadcn/ui component library
- Sets up NextAuth.js with Google OAuth provider
- Provides session management and JWT token access for API calls
- Defines the root layout and auth API routes

## Files to Create
- `frontend/package.json` — dependencies
- `frontend/tsconfig.json`
- `frontend/next.config.ts`
- `frontend/tailwind.config.ts`
- `frontend/postcss.config.js`
- `frontend/app/layout.tsx` — root layout with providers (SessionProvider)
- `frontend/app/globals.css` — Tailwind directives + shadcn/ui CSS variables
- `frontend/app/api/auth/[...nextauth]/route.ts` — NextAuth API routes
- `frontend/lib/auth.ts` — NextAuth configuration (providers, callbacks)
- `frontend/lib/utils.ts` — `cn()` utility for Tailwind class merging
- `frontend/components/providers.tsx` — client-side SessionProvider wrapper
- `frontend/types/index.ts` — shared TypeScript type definitions
- `frontend/.env.example`
- `frontend/Dockerfile`

## Dependencies
```json
{
  "next": "^14.2",
  "react": "^18.3",
  "react-dom": "^18.3",
  "next-auth": "^5.0",
  "zustand": "^4.5",
  "react-markdown": "^9.0",
  "lucide-react": "^0.380",
  "tailwind-merge": "^2.3",
  "class-variance-authority": "^0.7",
  "clsx": "^2.1"
}
```

## Auth Configuration

### NextAuth Setup (`lib/auth.ts`)
- Provider: Google OAuth
- Session strategy: JWT
- Secret: `NEXTAUTH_SECRET` (shared with FastAPI backend)
- Callbacks:
  - `jwt`: On first sign-in, call backend to create/get user, store `userId` in token
  - `session`: Expose `userId` in the session object

### JWT Callback Flow
1. User signs in with Google
2. `jwt` callback fires with `account` and `profile`
3. Call FastAPI backend to ensure user exists in DB (or create)
4. Store the user's UUID as `token.userId`
5. On subsequent requests, `userId` is available from the token

### Getting the JWT for API Calls
The frontend needs the raw JWT token to send as `Authorization: Bearer <token>` to the FastAPI backend. Use NextAuth's `getToken()` or session management to access this.

## Environment Variables
| Variable              | Description                      |
|-----------------------|----------------------------------|
| NEXTAUTH_URL          | Base URL (http://localhost:3000) |
| NEXTAUTH_SECRET       | Shared JWT secret                |
| GOOGLE_CLIENT_ID      | Google OAuth client ID           |
| GOOGLE_CLIENT_SECRET  | Google OAuth client secret       |
| NEXT_PUBLIC_API_URL   | Backend API base URL             |

## TypeScript Types (`types/index.ts`)

```typescript
interface AgentConfig {
  name: string;
  personality: string;
  provider: 'openai' | 'anthropic';
  model: string;
}

interface Debate {
  id: string;
  topic: string;
  agent_a_config: AgentConfig;
  agent_b_config: AgentConfig;
  status: 'created' | 'running' | 'paused' | 'completed';
  current_turn: number;
  max_turns: number;
  turns: Turn[];
  created_at: string;
  updated_at: string;
}

interface DebateListItem {
  id: string;
  topic: string;
  status: string;
  current_turn: number;
  max_turns: number;
  agent_a_name: string;
  agent_b_name: string;
  created_at: string;
  updated_at: string;
}

interface Turn {
  turn_number: number;
  agent_name: string;
  agent_side: 'a' | 'b';
  content: string;
  model_used: string;
  created_at: string;
}

interface ApiKeys {
  openai?: string;
  anthropic?: string;
}
```

## Behavior & Constraints
- Root layout wraps the app in `SessionProvider` for client-side session access
- All `(app)/*` routes require authentication (redirect to `/login` if unauthenticated)
- `NEXT_PUBLIC_API_URL` is the only env var exposed to the client bundle
- shadcn/ui components are installed individually (button, card, dialog, input, label, select, textarea, avatar, scroll-area, separator, sheet, badge, dropdown-menu, tooltip)
- The `cn()` utility combines `clsx` and `tailwind-merge`

## Relevant Skills
- `shadcn` — shadcn/ui component library setup and usage
- `nextjs` — App Router, NextAuth.js integration
- `tailwindcss` — Tailwind CSS configuration
- `typescript` — strict TypeScript setup

### Recommended skills.sh Skills
- **shadcn** (official) — framework for building UI with shadcn/ui components added as source code via CLI
  ```bash
  npx skills add shadcn/ui/shadcn
  ```
- **next-best-practices** — comprehensive Next.js guidelines covering App Router, RSC patterns, data fetching, optimization, error handling, and Docker self-hosting
  ```bash
  npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
  ```
- **vercel-react-best-practices** — React + Next.js performance optimization with 69 rules across 8 categories (RSC, client-side, async, rendering)
  ```bash
  npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
  ```
- **tailwind-v4-shadcn** — Tailwind v4 with shadcn/ui implementation using CSS variables and @theme inline pattern
  ```bash
  npx skills add https://github.com/jezweb/claude-skills --skill tailwind-v4-shadcn
  ```
- **frontend-design** — guides creation of distinctive, production-grade frontend interfaces; covers typography, color theming, motion, and spatial composition
  ```bash
  npx skills add https://github.com/anthropics/skills --skill frontend-design
  ```

## Tests to Validate
- **Auth route exists**: `/api/auth/[...nextauth]` route handler is configured
- **Session provider**: Root layout renders SessionProvider
- **Protected routes**: Unauthenticated access to `/app/*` redirects to login
- **JWT token**: After sign-in, `getToken()` returns a valid JWT with `userId`
- **Types**: All TypeScript types compile without errors
- **shadcn/ui**: At least one shadcn component (e.g., Button) renders correctly
- **Environment**: `NEXT_PUBLIC_API_URL` is accessible in client components
- **Auth callback**: JWT callback stores userId from backend response
