import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateDebateForm from "@/components/debate/CreateDebateForm";
import type { Debate } from "@/types";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock API keys store
const mockHasKey = vi.fn(() => true);
vi.mock("@/stores/apiKeys", () => ({
  useApiKeysStore: (selector: (s: { hasKey: typeof mockHasKey }) => unknown) =>
    selector({ hasKey: mockHasKey }),
}));

// Mock debate manager store
const mockStartDebate = vi.fn();
vi.mock("@/stores/debateManager", () => ({
  useDebateManagerStore: (
    selector: (s: { startDebate: typeof mockStartDebate }) => unknown,
  ) => selector({ startDebate: mockStartDebate }),
}));

// Mock API
const mockCreateDebate = vi.fn();
vi.mock("@/lib/api", () => ({
  createDebate: (...args: unknown[]) => mockCreateDebate(...args),
}));

const mockDebateResponse: Debate = {
  id: "debate-123",
  topic: "Test topic",
  agent_a_config: {
    name: "Agent A",
    personality: "Bold",
    provider: "openai",
    model: "gpt-4o",
  },
  agent_b_config: {
    name: "Agent B",
    personality: "Cautious",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },
  status: "created",
  current_turn: 0,
  max_turns: 6,
  turns: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("CreateDebateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasKey.mockReturnValue(true);
    mockCreateDebate.mockResolvedValue(mockDebateResponse);
  });

  it("renders form with all fields", () => {
    render(<CreateDebateForm />);

    expect(screen.getByText("Create New Debate")).toBeDefined();
    expect(screen.getByLabelText("Topic")).toBeDefined();
    expect(screen.getByText("Agent A")).toBeDefined();
    expect(screen.getByText("Agent B")).toBeDefined();
    expect(screen.getByLabelText("Max Turns")).toBeDefined();
    expect(screen.getByRole("button", { name: /Start Debate/i })).toBeDefined();
  });

  it("shows topic character count", async () => {
    const user = userEvent.setup();
    render(<CreateDebateForm />);

    const topicInput = screen.getByLabelText("Topic");
    await user.type(topicInput, "Hello");

    expect(screen.getByText("5/2000")).toBeDefined();
  });

  it("validates empty required fields on submit", async () => {
    const user = userEvent.setup();
    render(<CreateDebateForm />);

    const submitBtn = screen.getByRole("button", { name: /Start Debate/i });
    await user.click(submitBtn);

    expect(screen.getByText("Topic is required")).toBeDefined();
    expect(screen.getByText("Agent A name is required")).toBeDefined();
    expect(screen.getByText("Agent B name is required")).toBeDefined();
    expect(mockCreateDebate).not.toHaveBeenCalled();
  });

  it("validates missing API keys on submit", async () => {
    const user = userEvent.setup();
    mockHasKey.mockReturnValue(false);
    render(<CreateDebateForm />);

    // Fill required fields
    await user.type(screen.getByLabelText("Topic"), "Test topic");
    const nameInputs = screen.getAllByLabelText("Name");
    await user.type(nameInputs[0], "Agent A");
    await user.type(nameInputs[1], "Agent B");
    const personalityInputs = screen.getAllByLabelText("Personality");
    await user.type(personalityInputs[0], "Bold");
    await user.type(personalityInputs[1], "Cautious");

    await user.click(screen.getByRole("button", { name: /Start Debate/i }));

    expect(screen.getByText(/Please add your .* API key/)).toBeDefined();
    expect(mockCreateDebate).not.toHaveBeenCalled();
  });

  it("submits valid form and navigates to debate", async () => {
    const user = userEvent.setup();
    render(<CreateDebateForm />);

    // Fill form
    await user.type(screen.getByLabelText("Topic"), "Test topic");
    const nameInputs = screen.getAllByLabelText("Name");
    await user.type(nameInputs[0], "Pro");
    await user.type(nameInputs[1], "Con");
    const personalityInputs = screen.getAllByLabelText("Personality");
    await user.type(personalityInputs[0], "Bold debater");
    await user.type(personalityInputs[1], "Cautious analyst");

    await user.click(screen.getByRole("button", { name: /Start Debate/i }));

    await waitFor(() => {
      expect(mockCreateDebate).toHaveBeenCalledWith({
        topic: "Test topic",
        agent_a: expect.objectContaining({ name: "Pro", personality: "Bold debater" }),
        agent_b: expect.objectContaining({ name: "Con", personality: "Cautious analyst" }),
        max_turns: 6,
      });
    });

    await waitFor(() => {
      expect(mockStartDebate).toHaveBeenCalledWith("debate-123", 6);
      expect(mockPush).toHaveBeenCalledWith("/debate/debate-123");
    });
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    // Make createDebate hang
    mockCreateDebate.mockReturnValue(new Promise(() => {}));
    render(<CreateDebateForm />);

    // Fill form
    await user.type(screen.getByLabelText("Topic"), "Test topic");
    const nameInputs = screen.getAllByLabelText("Name");
    await user.type(nameInputs[0], "Pro");
    await user.type(nameInputs[1], "Con");
    const personalityInputs = screen.getAllByLabelText("Personality");
    await user.type(personalityInputs[0], "Bold");
    await user.type(personalityInputs[1], "Cautious");

    await user.click(screen.getByRole("button", { name: /Start Debate/i }));

    await waitFor(() => {
      expect(screen.getByText("Creating Debate…")).toBeDefined();
    });
  });

  it("shows backend error message on submission failure", async () => {
    const user = userEvent.setup();
    mockCreateDebate.mockRejectedValue(new Error("Missing API key for openai"));
    render(<CreateDebateForm />);

    // Fill form
    await user.type(screen.getByLabelText("Topic"), "Test topic");
    const nameInputs = screen.getAllByLabelText("Name");
    await user.type(nameInputs[0], "Pro");
    await user.type(nameInputs[1], "Con");
    const personalityInputs = screen.getAllByLabelText("Personality");
    await user.type(personalityInputs[0], "Bold");
    await user.type(personalityInputs[1], "Cautious");

    await user.click(screen.getByRole("button", { name: /Start Debate/i }));

    await waitFor(() => {
      expect(screen.getByText("Missing API key for openai")).toBeDefined();
    });
  });

  it("renders max turns input with default value", () => {
    render(<CreateDebateForm />);

    const maxTurnsInput = screen.getByLabelText("Max Turns") as HTMLInputElement;
    expect(maxTurnsInput.value).toBe("6");
    expect(maxTurnsInput.type).toBe("number");
    expect(maxTurnsInput.min).toBe("2");
    expect(maxTurnsInput.max).toBe("100");
  });
});
