from unittest.mock import patch

import pytest
from agents import Agent, OpenAIResponsesModel
from agents.extensions.models.litellm_provider import LitellmModel

from app.services.agent_factory import build_system_prompt, create_agent


OPENAI_CONFIG = {
    "name": "Debater A",
    "personality": "Analytical and precise, uses data to support claims.",
    "provider": "openai",
    "model": "gpt-4o",
}

ANTHROPIC_CONFIG = {
    "name": "Debater B",
    "personality": "Creative and persuasive, uses storytelling.",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
}

FAKE_API_KEY = "sk-fake-test-key-12345"


class TestCreateAgentOpenAI:
    def test_returns_agent_instance(self):
        agent = create_agent(OPENAI_CONFIG, FAKE_API_KEY)
        assert isinstance(agent, Agent)

    def test_agent_name(self):
        agent = create_agent(OPENAI_CONFIG, FAKE_API_KEY)
        assert agent.name == "Debater A"

    def test_model_is_openai_responses_model(self):
        agent = create_agent(OPENAI_CONFIG, FAKE_API_KEY)
        assert isinstance(agent.model, OpenAIResponsesModel)

    def test_per_user_client(self):
        agent1 = create_agent(OPENAI_CONFIG, "sk-key-one-1111")
        agent2 = create_agent(OPENAI_CONFIG, "sk-key-two-2222")
        # Each call should create a distinct OpenAI client
        client1 = agent1.model._client
        client2 = agent2.model._client
        assert client1 is not client2


class TestCreateAgentAnthropic:
    def test_returns_agent_instance(self):
        agent = create_agent(ANTHROPIC_CONFIG, FAKE_API_KEY)
        assert isinstance(agent, Agent)

    def test_agent_name(self):
        agent = create_agent(ANTHROPIC_CONFIG, FAKE_API_KEY)
        assert agent.name == "Debater B"

    def test_model_is_litellm_model(self):
        agent = create_agent(ANTHROPIC_CONFIG, FAKE_API_KEY)
        assert isinstance(agent.model, LitellmModel)

    def test_model_name_has_anthropic_prefix(self):
        agent = create_agent(ANTHROPIC_CONFIG, FAKE_API_KEY)
        assert agent.model.model == "anthropic/claude-sonnet-4-20250514"


class TestUnsupportedProvider:
    def test_raises_value_error(self):
        config = {
            "name": "Agent X",
            "personality": "Unknown",
            "provider": "google",
            "model": "gemini-pro",
        }
        with pytest.raises(ValueError, match="Unsupported provider: google"):
            create_agent(config, FAKE_API_KEY)


class TestBuildSystemPrompt:
    def test_includes_name(self):
        prompt = build_system_prompt("TestBot", "Very logical")
        assert "TestBot" in prompt

    def test_includes_personality(self):
        prompt = build_system_prompt("TestBot", "Very logical")
        assert "Very logical" in prompt

    def test_includes_debate_rules(self):
        prompt = build_system_prompt("TestBot", "Very logical")
        assert "under 500 words" in prompt
        assert "Be persuasive and substantive" in prompt
        assert "Do not repeat previous arguments verbatim" in prompt

    def test_includes_opponent_instruction(self):
        prompt = build_system_prompt("TestBot", "Very logical")
        assert "opponent" in prompt.lower()

    def test_instructions_set_on_agent(self):
        agent = create_agent(OPENAI_CONFIG, FAKE_API_KEY)
        assert "Debater A" in agent.instructions
        assert OPENAI_CONFIG["personality"] in agent.instructions
