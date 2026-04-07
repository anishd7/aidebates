from __future__ import annotations

from agents import Agent, OpenAIResponsesModel, function_tool
from agents.extensions.models.litellm_provider import LitellmModel
from openai import AsyncOpenAI
from tavily import TavilyClient


def build_system_prompt(name: str, personality: str, web_search_enabled: bool) -> str:
    """Build the system prompt for a debate agent."""
    from datetime import date

    base = (
        f"Today's date is {date.today().isoformat()}.\n\n"
        f"You are {name}, a debater with the following personality:\n"
        f"{personality}\n"
        "\n"
        "You are participating in a structured debate. Your opponent's arguments will be presented\n"
        "as messages labeled with their name. Respond with your next argument.\n"
        "\n"
        "Rules:\n"
        "- Be persuasive and substantive\n"
        "- Directly address your opponent's most recent points\n"
        "- Do not repeat previous arguments verbatim\n"
        "- Support claims with reasoning and evidence\n"
        "- Keep responses focused and under 500 words"
    )
    if web_search_enabled:
        base += (
            "\n\nYou have access to a web_search tool. Use it to find current facts, "
            "statistics, and evidence to strengthen your arguments. Cite your sources."
        )
    return base


def _make_web_search_tool(tavily_api_key: str):
    """Create a web_search function tool backed by Tavily."""
    client = TavilyClient(api_key=tavily_api_key)

    @function_tool
    def web_search(query: str) -> str:
        """Search the web for current information relevant to the debate. Returns a summary of search results."""
        print(f"[WEB SEARCH] query: {query}")
        response = client.search(query, max_results=5, search_depth="advanced")
        parts: list[str] = []
        for result in response.get("results", []):
            title = result.get("title", "")
            url = result.get("url", "")
            content = result.get("content", "")
            parts.append(f"**{title}**\n{url}\n{content}")
        return "\n\n---\n\n".join(parts) if parts else "No results found."

    return web_search


def create_agent(
    agent_config: dict,
    api_key: str,
    tavily_api_key: str | None = None,
) -> Agent:
    """Create an Agent instance from debate config and a decrypted API key.

    Args:
        agent_config: Dict with keys: name, personality, provider, model,
            and optionally web_search_enabled.
        api_key: Decrypted API key for the agent's provider.
        tavily_api_key: Optional Tavily API key for web search.

    Returns:
        Configured Agent instance ready for Runner.run_streamed().

    Raises:
        ValueError: If the provider is not supported.
    """
    name: str = agent_config["name"]
    personality: str = agent_config["personality"]
    provider: str = agent_config["provider"]
    model_name: str = agent_config["model"]
    web_search_enabled: bool = agent_config.get("web_search_enabled", False)

    print(
        f"[CREATE AGENT] name={name} provider={provider} model={model_name} "
        f"web_search_enabled={web_search_enabled} tavily_key_present={tavily_api_key is not None}"
    )

    if provider == "openai":
        client = AsyncOpenAI(api_key=api_key)
        model = OpenAIResponsesModel(model=model_name, openai_client=client)
    elif provider == "anthropic":
        litellm_model_name = f"anthropic/{model_name}"
        model = LitellmModel(model=litellm_model_name, api_key=api_key)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    tools = []
    if web_search_enabled and tavily_api_key:
        tools.append(_make_web_search_tool(tavily_api_key))
        print(f"[CREATE AGENT] Web search tool registered for {name}")

    instructions = build_system_prompt(name, personality, web_search_enabled)

    return Agent(name=name, model=model, instructions=instructions, tools=tools)
