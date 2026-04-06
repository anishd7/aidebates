# Component: Create Debate Form

## Overview
Form page for creating a new debate. Users configure a topic, two agents (name, personality, provider, model), and submit to start the debate.

## What It Does
- Renders a form with topic input and two agent configuration panels
- Validates inputs client-side before submission
- Checks that required API keys are configured for selected providers
- Submits to `POST /api/v1/debates` and navigates to the debate view on success
- Triggers the debate loop to start automatically

## Files to Create
- `frontend/app/(app)/new/page.tsx` — create debate page
- `frontend/components/debate/CreateDebateForm.tsx` — main form component
- `frontend/components/debate/AgentConfig.tsx` — agent configuration sub-form (reused for agent A and B)

## Dependencies
- Component `09-frontend-setup` (types, shadcn/ui)
- Component `10-api-client-sse` (`createDebate` API method)
- Component `11-debate-manager-store` (`startDebate` action)
- Component `12-api-keys-store` (`hasKey` for validation)
- shadcn/ui: `input`, `textarea`, `select`, `button`, `card`, `label`

## Form Fields

### Topic
- **Input**: Textarea
- **Validation**: Required, max 2000 characters
- **Placeholder**: "e.g., Should artificial intelligence be regulated by governments?"

### Agent A & Agent B (identical sub-forms)

#### Name
- **Input**: Text input
- **Validation**: Required, max 100 characters
- **Placeholder**: "e.g., Pro Regulation"

#### Provider
- **Input**: Select dropdown
- **Options**: "OpenAI", "Anthropic"
- **Behavior**: Changing provider resets the model selection; shows warning if no API key configured for this provider

#### Model
- **Input**: Select dropdown
- **Options** (varies by provider):
  - OpenAI: `gpt-4o` ("GPT-4o"), `gpt-4o-mini` ("GPT-4o Mini"), `gpt-4.1` ("GPT-4.1"), `gpt-4.1-mini` ("GPT-4.1 Mini"), `gpt-4.1-nano` ("GPT-4.1 Nano")
  - Anthropic: `claude-sonnet-4-20250514` ("Claude Sonnet 4"), `claude-opus-4-20250514` ("Claude Opus 4"), `claude-haiku-3.5` ("Claude 3.5 Haiku")

#### Personality
- **Input**: Textarea
- **Validation**: Required, max 1000 characters
- **Placeholder**: "e.g., A cautious policy expert who believes in strong governmental oversight of technology"

### Max Turns (optional, advanced)
- **Input**: Number input or slider
- **Default**: 100
- **Validation**: 2-100
- **Note**: Could be hidden behind an "Advanced" toggle

## Layout
Two agent config panels side by side on desktop, stacked on mobile:
```
┌──────────────────────────────────────────────────────┐
│  Create New Debate                                   │
├──────────────────────────────────────────────────────┤
│  Debate Topic                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ [textarea]                                    │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────┐ ┌─────────────────────┐    │
│  │ Agent A              │ │ Agent B              │    │
│  │ [name input]         │ │ [name input]         │    │
│  │ [provider select]    │ │ [provider select]    │    │
│  │ [model select]       │ │ [model select]       │    │
│  │ [personality text]   │ │ [personality text]   │    │
│  └─────────────────────┘ └─────────────────────┘    │
│                                                      │
│  [Start Debate]                                      │
└──────────────────────────────────────────────────────┘
```

## Submit Flow
1. Client-side validation (all required fields, character limits)
2. Check `apiKeysStore.hasKey(agentA.provider)` and `hasKey(agentB.provider)`
   - If missing: show inline warning "Please add your {provider} API key in Settings"
3. Call `createDebate(formData)` → `POST /api/v1/debates`
4. On success:
   - Navigate to `/app/debate/{debate.id}`
   - Call `debateManager.startDebate(debate.id, debate.max_turns)`
   - Refresh sidebar debate list
5. On error: show error message from backend

## Behavior & Constraints
- The model list is hardcoded in the frontend (not fetched from backend)
- Provider selection determines which models are shown
- If user hasn't configured a key for a provider, show a warning but don't disable selection (they might add it before submitting)
- The "Start Debate" button shows a loading spinner during submission
- Form state is local (React state or form library), not persisted
- Agent A panel uses blue accent, Agent B panel uses green accent (matching debate message colors)

## Relevant Skills
- `shadcn` — form components (Input, Textarea, Select, Button, Card, Label)
- `react` — form state management, validation
- `tailwindcss` — responsive grid layout

### Recommended skills.sh Skills
- **shadcn** (official) — expert guidance for shadcn/ui form components (Input, Textarea, Select, Button, Card, Label)
  ```bash
  npx skills add shadcn/ui/shadcn
  ```
- **vercel-react-best-practices** — React performance patterns for form state management and rendering optimization
  ```bash
  npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
  ```
- **responsive-design** — responsive grid layouts, mobile-first design, and adaptive form patterns
  ```bash
  npx skills add https://github.com/wshobson/agents --skill responsive-design
  ```

## Tests to Validate
- **Renders**: Form renders with all fields (topic, 2x agent configs)
- **Provider change**: Changing provider updates model dropdown options
- **Validation**: Empty required fields prevent submission
- **Validation**: Topic > 2000 chars shows error
- **Missing API key warning**: Selecting a provider without a configured key shows warning
- **Submission**: Valid form calls `createDebate` API
- **Navigation**: Successful creation navigates to debate view
- **Loading state**: Button shows loading during submission
- **Error display**: Backend error message is shown to user
- **Model list**: OpenAI provider shows 5 models, Anthropic shows 3 models
