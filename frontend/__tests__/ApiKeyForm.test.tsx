import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiKeyForm from "@/components/settings/ApiKeyForm";

// Mock API methods
const mockSaveKey = vi.fn();
const mockDeleteKey = vi.fn();
vi.mock("@/lib/api", () => ({
  saveKey: (...args: unknown[]) => mockSaveKey(...args),
  deleteKey: (...args: unknown[]) => mockDeleteKey(...args),
}));

// Mock store state
let mockConfigured: { key_last_four: string; updated_at: string } | undefined;
const mockRefreshKeys = vi.fn();

vi.mock("@/stores/apiKeys", () => ({
  useApiKeysStore: (
    selector: (s: {
      configured: { openai?: typeof mockConfigured; anthropic?: typeof mockConfigured };
      refreshKeys: typeof mockRefreshKeys;
    }) => unknown,
  ) =>
    selector({
      configured: {
        openai: mockConfigured,
        anthropic: undefined,
      },
      refreshKeys: mockRefreshKeys,
    }),
}));

describe("ApiKeyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigured = undefined;
    mockSaveKey.mockResolvedValue({
      provider: "openai",
      key_last_four: "ab12",
      updated_at: "2026-04-05T00:00:00Z",
    });
    mockDeleteKey.mockResolvedValue(undefined);
    mockRefreshKeys.mockResolvedValue(undefined);
  });

  it("renders provider name and not configured state", () => {
    render(<ApiKeyForm provider="openai" />);

    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.getByText("Not configured")).toBeDefined();
    expect(screen.getByText("Add Key")).toBeDefined();
  });

  it("renders configured state with last 4 chars and date", () => {
    mockConfigured = {
      key_last_four: "c123",
      updated_at: "2026-04-05T12:00:00Z",
    };
    render(<ApiKeyForm provider="openai" />);

    expect(screen.getByText("Configured")).toBeDefined();
    expect(screen.getByText("****c123")).toBeDefined();
    expect(screen.getByText(/Updated Apr/)).toBeDefined();
    expect(screen.getByText("Update Key")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it("shows input when Add Key is clicked", async () => {
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Add Key"));

    expect(screen.getByLabelText("API Key")).toBeDefined();
    expect(screen.getByPlaceholderText("Enter your OpenAI API key")).toBeDefined();
    expect(screen.getByText("Save")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("shows input when Update Key is clicked", async () => {
    mockConfigured = {
      key_last_four: "c123",
      updated_at: "2026-04-05T00:00:00Z",
    };
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Update Key"));

    expect(screen.getByLabelText("API Key")).toBeDefined();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Add Key"));
    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    expect(input.type).toBe("password");

    await user.click(screen.getByLabelText("Show API key"));
    expect(input.type).toBe("text");

    await user.click(screen.getByLabelText("Hide API key"));
    expect(input.type).toBe("password");
  });

  it("cancels editing and returns to idle", async () => {
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Add Key"));
    expect(screen.getByLabelText("API Key")).toBeDefined();

    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByLabelText("API Key")).toBeNull();
    expect(screen.getByText("Add Key")).toBeDefined();
  });

  it("saves key and calls refreshKeys", async () => {
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Add Key"));
    await user.type(screen.getByLabelText("API Key"), "sk-test-key-1234");
    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockSaveKey).toHaveBeenCalledWith("openai", "sk-test-key-1234");
    });
    expect(mockRefreshKeys).toHaveBeenCalled();
    expect(screen.getByText("API key saved successfully.")).toBeDefined();
    // Input should be cleared
    expect(screen.queryByLabelText("API Key")).toBeNull();
  });

  it("shows error when save fails", async () => {
    mockSaveKey.mockRejectedValue(new Error("Invalid API key"));
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Add Key"));
    await user.type(screen.getByLabelText("API Key"), "bad-key");
    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Invalid API key")).toBeDefined();
    });
    // Should still be in editing state
    expect(screen.getByLabelText("API Key")).toBeDefined();
  });

  it("shows error when key is empty", async () => {
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Add Key"));
    // Save button should be disabled with empty input
    const saveButton = screen.getByText("Save") as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it("shows delete confirmation", async () => {
    mockConfigured = {
      key_last_four: "c123",
      updated_at: "2026-04-05T00:00:00Z",
    };
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Delete"));

    expect(
      screen.getByText("Are you sure? Active debates using this key will fail."),
    ).toBeDefined();
  });

  it("cancels delete confirmation", async () => {
    mockConfigured = {
      key_last_four: "c123",
      updated_at: "2026-04-05T00:00:00Z",
    };
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Delete"));
    // Click the Cancel in the confirmation, not the main Cancel
    const cancelButtons = screen.getAllByText("Cancel");
    await user.click(cancelButtons[0]);

    expect(
      screen.queryByText(
        "Are you sure? Active debates using this key will fail.",
      ),
    ).toBeNull();
  });

  it("deletes key after confirmation and calls refreshKeys", async () => {
    mockConfigured = {
      key_last_four: "c123",
      updated_at: "2026-04-05T00:00:00Z",
    };
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Delete"));
    // Click the destructive Delete button in the confirmation
    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(mockDeleteKey).toHaveBeenCalledWith("openai");
    });
    expect(mockRefreshKeys).toHaveBeenCalled();
    expect(screen.getByText("API key deleted successfully.")).toBeDefined();
  });

  it("shows error when delete fails", async () => {
    mockConfigured = {
      key_last_four: "c123",
      updated_at: "2026-04-05T00:00:00Z",
    };
    mockDeleteKey.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    render(<ApiKeyForm provider="openai" />);

    await user.click(screen.getByText("Delete"));
    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });
  });

  it("renders Anthropic provider correctly", () => {
    render(<ApiKeyForm provider="anthropic" />);

    expect(screen.getByText("Anthropic")).toBeDefined();
    expect(screen.getByText("Not configured")).toBeDefined();
  });
});
