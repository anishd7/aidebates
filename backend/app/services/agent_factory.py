from agents import Agent
from agents.extensions.models.litellm_provider import LitellmModel
from openai import AsyncOpenAI

from agents import OpenAIResponsesModel


def build_system_prompt(name: str, personality: str) -> str:
    """Build the system prompt for a debate agent."""
    return (
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


def create_agent(agent_config: dict, api_key: str) -> Agent:
    """Create an Agent instance from debate config and a decrypted API key.

    Args:
        agent_config: Dict with keys: name, personality, provider, model.
        api_key: Decrypted API key for the agent's provider.

    Returns:
        Configured Agent instance ready for Runner.run_streamed().

    Raises:
        ValueError: If the provider is not supported.
    """
    name: str = agent_config["name"]
    personality: str = agent_config["personality"]
    provider: str = agent_config["provider"]
    model_name: str = agent_config["model"]

    if provider == "openai":
        client = AsyncOpenAI(api_key=api_key)
        model = OpenAIResponsesModel(model=model_name, openai_client=client)
    elif provider == "anthropic":
        litellm_model_name = f"anthropic/{model_name}"
        model = LitellmModel(model=litellm_model_name, api_key=api_key)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    instructions = build_system_prompt(name, personality)

    return Agent(name=name, model=model, instructions=instructions)
