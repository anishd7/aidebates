# Component: Landing Page

## Overview
Public, SEO-optimized landing page that introduces AI Debate Arena and drives sign-ups. Also includes the login page with Google OAuth.

## What It Does
- Renders a marketing-style landing page at `/`
- Highlights key features (AI debate, multiple models, real-time streaming)
- Provides "Get Started" CTA that leads to login
- Renders the login page at `/login` with Google OAuth button

## Files to Create
- `frontend/app/page.tsx` — landing page
- `frontend/app/(auth)/login/page.tsx` — login page

## Dependencies
- Component `09-frontend-setup` (NextAuth, shadcn/ui)
- shadcn/ui: `button`, `card`
- `lucide-react` icons

## Landing Page Layout (`/`)

```
┌──────────────────────────────────────────────────────┐
│  [Logo] AI Debate Arena              [Sign In]       │
├──────────────────────────────────────────────────────┤
│                                                      │
│           Watch AI Models Debate                     │
│                                                      │
│   Configure two AI agents, pick a topic, and watch   │
│   them debate in real-time. GPT vs Claude? You       │
│   decide.                                            │
│                                                      │
│              [Get Started →]                         │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Multiple │  │ Real-time│  │ Share &  │          │
│  │ Models   │  │ Streaming│  │ Resume   │          │
│  │          │  │          │  │          │          │
│  │ GPT-4.1, │  │ Watch    │  │ Share    │          │
│  │ Claude,  │  │ tokens   │  │ debates  │          │
│  │ and more │  │ stream   │  │ publicly │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
├──────────────────────────────────────────────────────┤
│  © 2026 AI Debate Arena                              │
└──────────────────────────────────────────────────────┘
```

### Sections
1. **Navbar**: Logo + "Sign In" button (top right)
2. **Hero**: Headline, subheadline, CTA button
3. **Features**: 3 feature cards (multi-model, streaming, share/resume)
4. **Footer**: Minimal copyright

## Login Page (`/login`)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              AI Debate Arena                         │
│                                                      │
│         Sign in to start debating                    │
│                                                      │
│      ┌──────────────────────────┐                    │
│      │  🔵 Sign in with Google  │                    │
│      └──────────────────────────┘                    │
│                                                      │
│      By signing in, you agree to our terms.          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Behavior
- Clicking "Sign in with Google" triggers NextAuth's `signIn('google')`
- On successful auth, redirect to `/app`
- If already authenticated, redirect to `/app`

## Behavior & Constraints
- Landing page is a server component (SEO-friendly, no client JS needed for content)
- Login page is a client component (needs `signIn` function)
- Both pages are public (no auth required)
- "Get Started" button on landing page navigates to `/login`
- "Sign In" button in navbar also goes to `/login`
- Clean, minimal design consistent with the rest of the app

## SEO Metadata
```typescript
export const metadata = {
  title: 'AI Debate Arena — Watch AI Models Debate in Real-Time',
  description: 'Configure two AI agents, pick a topic, and watch them debate live. Supports GPT-4.1, Claude, and more.',
};
```

## Relevant Skills
- `nextjs` — server components, metadata, routing
- `shadcn` — Button, Card
- `tailwindcss` — responsive landing page layout
- `lucide-react` — feature icons

### Recommended skills.sh Skills
- **frontend-design** — guides creation of distinctive, production-grade landing pages; covers bold aesthetic direction, typography, color theming, and motion to avoid generic "AI slop" aesthetics
  ```bash
  npx skills add https://github.com/anthropics/skills --skill frontend-design
  ```
- **shadcn** (official) — expert guidance for shadcn/ui component usage (Button, Card)
  ```bash
  npx skills add shadcn/ui/shadcn
  ```
- **next-best-practices** — Next.js server components, metadata generation, and SEO patterns
  ```bash
  npx skills add https://github.com/vercel-labs/next-skills --skill next-best-practices
  ```
- **responsive-design** — modern responsive landing page techniques including mobile-first layouts, fluid typography, and CSS clamp()
  ```bash
  npx skills add https://github.com/wshobson/agents --skill responsive-design
  ```
- **tailwind-design-system** — CSS-first design system with tokens, components, and responsive patterns
  ```bash
  npx skills add https://github.com/wshobson/agents --skill tailwind-design-system
  ```

## Tests to Validate
- **Landing renders**: Page renders with hero, features, and CTA
- **CTA navigation**: "Get Started" button links to `/login`
- **Login renders**: Login page shows Google sign-in button
- **Sign-in action**: Clicking Google button triggers NextAuth sign-in
- **Auth redirect**: Already-authenticated users on `/login` redirect to `/app`
- **SEO metadata**: Page has correct title and description
- **Responsive**: Layout works on mobile and desktop
