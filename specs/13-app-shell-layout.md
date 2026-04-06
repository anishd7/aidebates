# Component: App Shell & Layout

## Overview
The main application shell with a Claude.ai-inspired sidebar layout. Includes the collapsible sidebar with debate list, top header with user menu, and the main content area.

## What It Does
- Renders the authenticated app layout (sidebar + header + content area)
- Displays a list of user's debates in the sidebar (most recent first)
- Shows debate status badges and active indicators in the sidebar
- Provides navigation between debates, new debate form, and settings
- Handles sidebar collapse on mobile
- Shows user avatar and dropdown menu in the header

## Files to Create
- `frontend/app/(app)/layout.tsx` — app layout with sidebar
- `frontend/app/(app)/page.tsx` — redirects to `/app/debates`
- `frontend/components/layout/AppShell.tsx` — main shell component
- `frontend/components/layout/Sidebar.tsx` — debate list sidebar
- `frontend/components/layout/Header.tsx` — top header with user menu

## Dependencies
- Component `09-frontend-setup` (NextAuth session, shadcn/ui components, types)
- Component `10-api-client-sse` (`listDebates` API method)
- Component `11-debate-manager-store` (for active debate status indicators)
- shadcn/ui: `avatar`, `dropdown-menu`, `badge`, `sheet` (mobile sidebar), `separator`, `scroll-area`, `button`, `tooltip`
- `lucide-react` icons

## Layout Structure

```
┌──────────────────────────────────────────────────────┐
│  Header (logo, user avatar + dropdown)               │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Sidebar  │  {children} — Main Content Area           │
│ (260px)  │                                           │
│          │                                           │
│ [+ New]  │                                           │
│          │                                           │
│ Debate 1 │                                           │
│ Debate 2 │                                           │
│ (active) │                                           │
│ Debate 3 │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

## Sidebar (`Sidebar.tsx`)

### Content
- "+ New Debate" button at top (navigates to `/app/new`)
- Scrollable list of debates from `GET /api/v1/debates`
- Each debate entry shows:
  - Topic (truncated to ~40 chars with ellipsis)
  - Status badge: green pulsing dot (running), yellow dot (paused), gray checkmark (completed)
  - Agent names (subtle, small text)
- Active debate (current route) is highlighted
- Clicking a debate navigates to `/app/debate/[id]`

### Behavior
- Fetches debate list on mount and after creating a new debate
- Debates ordered by `created_at DESC` (most recent first)
- Running debates show a subtle pulsing animation on the status indicator
- On mobile (< 768px): sidebar is hidden, accessible via hamburger menu (shadcn `Sheet`)
- Sidebar width: 260px fixed on desktop

## Header (`Header.tsx`)

### Content
- Left: App logo/name ("AI Debate Arena")
- Left (mobile only): Hamburger menu button to toggle sidebar
- Right: User avatar (from Google OAuth) with dropdown menu
  - Display name and email
  - "Settings" link → `/app/settings`
  - "Sign Out" button

## App Layout (`(app)/layout.tsx`)

### Behavior
- Wraps all `/app/*` routes
- Checks authentication — redirects to `/login` if not authenticated
- Renders `AppShell` which contains `Header`, `Sidebar`, and `{children}`
- On mount: calls `fetchKeys()` from API keys store to cache keys
- On mount: fetches debate list for sidebar

## Design Specifications
- **Background**: `slate-50`
- **Sidebar**: `white` background, `slate-200` right border
- **Header**: `white` background, `slate-200` bottom border, height ~56px
- **Active sidebar item**: `slate-100` background, `slate-900` text
- **Inactive sidebar item**: `slate-600` text, hover `slate-100` background
- **Status badges**:
  - Running: `green-500` pulsing dot
  - Paused: `yellow-500` static dot
  - Completed: `slate-400` checkmark icon
  - Created: `blue-500` static dot

## Relevant Skills
- `shadcn` — component usage (Sheet for mobile sidebar, DropdownMenu, Avatar, Badge, ScrollArea)
- `nextjs` — App Router layouts, client-side navigation
- `tailwindcss` — responsive design, animations
- `lucide-react` — icon usage

### Recommended skills.sh Skills
- **shadcn** (official) — expert guidance for shadcn/ui component installation and customization (Sheet, DropdownMenu, Avatar, Badge, ScrollArea)
  ```bash
  npx skills add shadcn/ui/shadcn
  ```
- **next-best-practices** — Next.js App Router layout patterns, RSC boundaries, and file conventions
  ```bash
  npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
  ```
- **responsive-design** — modern responsive techniques including mobile-first layouts, container queries, and adaptive navigation patterns
  ```bash
  npx skills add https://github.com/wshobson/agents --skill responsive-design
  ```
- **tailwind-design-system** — CSS-first design system framework for Tailwind with tokens, components, and responsive patterns
  ```bash
  npx skills add https://github.com/wshobson/agents --skill tailwind-design-system
  ```
- **frontend-design** — distinctive UI design covering typography, color theming, motion, and spatial composition
  ```bash
  npx skills add https://github.com/anthropics/skills --skill frontend-design
  ```

## Tests to Validate
- **Layout renders**: AppShell renders with sidebar and content area
- **Sidebar debates**: Sidebar displays list of debates from API
- **Sidebar navigation**: Clicking a debate navigates to `/app/debate/[id]`
- **Active highlight**: Current debate is visually highlighted in sidebar
- **New debate button**: "+ New Debate" navigates to `/app/new`
- **Status badges**: Each status shows the correct visual indicator
- **User menu**: Avatar dropdown shows user name, settings link, sign out
- **Mobile sidebar**: On small screens, sidebar is hidden and accessible via sheet/drawer
- **Auth redirect**: Unauthenticated users are redirected to `/login`
- **Key fetch on mount**: `fetchKeys()` is called when the app layout mounts
