# Component: Agent Factory

## Overview
Creates OpenAI Agents SDK `Agent` instances dynamically from debate configuration and user-provided API keys. Supports OpenAI models natively and Anthropic models via LiteLLM.

## What It Does
- Takes an agent config (name, personality, provider, model) and a decrypted API key
- Creates the appropriate model wrapper (`OpenAIResponsesModel` or `LitellmModel`)
- Builds the system prompt with personality and debate rules
- Returns a configured `Agent` instance ready for `Runner.run_streamed()`

## Files to Create
- `backend/app/services/agent_factory.py`

## Dependencies
- `openai-agents>=0.1`
- `openai>=1.60`
- `litellm>=1.40`
- No internal component dependencies (pure function, takes config as input)

## Inputs
- `agent_config: dict` — `{ "name": str, "personality": str, "provider": str, "model": str }`
- `api_key: str` — decrypted API key for the agent's provider

## Outputs
- `Agent` instance from the OpenAI Agents SDK, configured with:
  - `name` — agent's display name
  - `model` — provider-specific model wrapper
  - `instructions` — system prompt with personality and debate rules

## Functions

### `create_agent(agent_config: dict, api_key: str) -> Agent`
1. Read `provider` and `model` from config
2. If provider is `"openai"`:
   - Create `AsyncOpenAI(api_key=api_key)` client
   - Create `OpenAIResponsesModel(model=model_name, openai_client=client)`
3. If provider is `"anthropic"`:
   - Import `LitellmModel` from `agents.extensions.models.litellm_provider`
   - Prepend `"anthropic/"` to model name for LiteLLM format
   - Create `LitellmModel(model=litellm_model_name, api_key=api_key)`
   - If `LitellmModel` doesn't accept `api_key` directly, set `os.environ["ANTHROPIC_API_KEY"]` before creating the model
4. Build system prompt via `build_system_prompt()`
5. Return `Agent(name=name, model=model, instructions=instructions)`

### `build_system_prompt(name: str, personality: str, agent_config: dict) -> str`
Returns the system prompt:
```
You are {name}, a debater with the following personality:
{personality}

You are participating in a structured debate. Your opponent's arguments will be presented
as messages labeled with their name. Respond with your next argument.

Rules:
- Be persuasive and substantive
- Directly address your opponent's most recent points
- Do not repeat previous arguments verbatim
- Support claims with reasoning and evidence
- Keep responses focused and under 500 words
```

## Behavior & Constraints
- Each call creates a fresh `AsyncOpenAI` client with the user's key — no shared clients
- For Anthropic, the LiteLLM model string must be `"anthropic/<model_name>"` (e.g., `"anthropic/claude-sonnet-4-20250514"`)
- The `LitellmModel` api_key handling may need a fallback (env var approach) — implementation should test both approaches
- Unsupported providers raise `ValueError`
- The system prompt is deterministic given the same inputs
- The `Agent` instance is stateless — it can be used for exactly one `Runner.run_streamed()` call

## Relevant Skills
- `python` — OpenAI Agents SDK patterns
- OpenAI Agents SDK documentation: `Agent`, `Runner`, `OpenAIResponsesModel`, `LitellmModel`

### Recommended skills.sh Skills
- **async-python-patterns** — async/await patterns for building non-blocking systems; relevant for async agent creation and streaming
  ```bash
  npx skills add https://github.com/wshobson/agents --skill async-python-patterns
  ```
- **python-testing-patterns** — pytest patterns for testing agent creation, including mocking external SDK calls
  ```bash
  npx skills add https://github.com/wshobson/agents --skill python-testing-patterns
  ```

## Tests to Validate
- **OpenAI agent creation**: `create_agent` with `provider="openai"` returns an Agent with `OpenAIResponsesModel`
- **Anthropic agent creation**: `create_agent` with `provider="anthropic"` returns an Agent with `LitellmModel`
- **Anthropic model name**: The LiteLLM model string is prefixed with `"anthropic/"`
- **System prompt content**: System prompt includes agent name and personality
- **System prompt rules**: System prompt includes the debate rules (500 word limit, etc.)
- **Unsupported provider**: `create_agent` with `provider="google"` raises `ValueError`
- **Per-user client**: Two calls with different API keys create distinct OpenAI clients
