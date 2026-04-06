import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentConfig from "@/components/debate/AgentConfig";
import type { AgentConfig as AgentConfigType } from "@/types";

// Mock the API keys store
const mockHasKey = vi.fn(() => true);
vi.mock("@/stores/apiKeys", () => ({
  useApiKeysStore: (selector: (s: { hasKey: typeof mockHasKey }) => unknown) =>
    selector({ hasKey: mockHasKey }),
}));

const defaultConfig: AgentConfigType = {
  name: "",
  personality: "",
  provider: "openai",
  model: "gpt-4o",
};

describe("AgentConfig", () => {
  let onChange: ReturnType<typeof vi.fn<(config: AgentConfigType) => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    onChange = vi.fn<(config: AgentConfigType) => void>();
    mockHasKey.mockReturnValue(true);
  });

  it("renders all form fields with labels", () => {
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByLabelText("Provider")).toBeDefined();
    expect(screen.getByLabelText("Model")).toBeDefined();
    expect(screen.getByLabelText("Personality")).toBeDefined();
  });

  it("displays the agent label in the header", () => {
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    expect(screen.getByText("Agent A")).toBeDefined();
  });

  it("calls onChange when name is typed", async () => {
    const user = userEvent.setup();
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "X");

    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, name: "X" });
  });

  it("calls onChange when personality is typed", async () => {
    const user = userEvent.setup();
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    const textarea = screen.getByLabelText("Personality");
    await user.type(textarea, "A");

    expect(onChange).toHaveBeenCalledWith({ ...defaultConfig, personality: "A" });
  });

  it("resets model when provider changes to anthropic", async () => {
    const user = userEvent.setup();
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    // Open provider select
    const providerTrigger = screen.getByLabelText("Provider");
    await user.click(providerTrigger);

    // Select Anthropic
    const anthropicOption = screen.getByText("Anthropic");
    await user.click(anthropicOption);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultConfig,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });
  });

  it("shows OpenAI models when provider is openai", () => {
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    // The currently selected model should be shown in the trigger
    expect(screen.getByText("GPT-4o")).toBeDefined();
  });

  it("shows Anthropic models when provider is anthropic", () => {
    const anthropicConfig: AgentConfigType = {
      ...defaultConfig,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    };
    render(
      <AgentConfig value={anthropicConfig} onChange={onChange} agentLabel="Agent B" />
    );

    expect(screen.getByText("Claude Sonnet 4")).toBeDefined();
  });

  it("shows missing API key warning when provider key is not configured", () => {
    mockHasKey.mockReturnValue(false);
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    expect(
      screen.getByText(/No API key configured for OpenAI/)
    ).toBeDefined();
  });

  it("does not show missing API key warning when key is configured", () => {
    mockHasKey.mockReturnValue(true);
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    expect(screen.queryByText(/No API key configured/)).toBeNull();
  });

  it("displays personality character count", () => {
    const config: AgentConfigType = {
      ...defaultConfig,
      personality: "Hello world",
    };
    render(
      <AgentConfig value={config} onChange={onChange} agentLabel="Agent A" />
    );

    expect(screen.getByText("11/1000")).toBeDefined();
  });

  it("uses blue accent color by default for Agent A", () => {
    const { container } = render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("border-blue-200");
  });

  it("uses green accent color for Agent B", () => {
    const { container } = render(
      <AgentConfig
        value={defaultConfig}
        onChange={onChange}
        agentLabel="Agent B"
        accentColor="green"
      />
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("border-emerald-200");
  });

  it("calls onChange when a different model is selected", async () => {
    const user = userEvent.setup();
    render(
      <AgentConfig value={defaultConfig} onChange={onChange} agentLabel="Agent A" />
    );

    const modelTrigger = screen.getByLabelText("Model");
    await user.click(modelTrigger);

    const miniOption = screen.getByText("GPT-4o Mini");
    await user.click(miniOption);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultConfig,
      model: "gpt-4o-mini",
    });
  });
});
