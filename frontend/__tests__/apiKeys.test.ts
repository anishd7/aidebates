import { describe, it, expect, vi, beforeEach } from "vitest";
import { useApiKeysStore } from "@/stores/apiKeys";

vi.mock("@/lib/api", () => ({
  listKeys: vi.fn(),
  decryptKeys: vi.fn(),
}));

import { listKeys, decryptKeys } from "@/lib/api";

const mockListKeys = vi.mocked(listKeys);
const mockDecryptKeys = vi.mocked(decryptKeys);

describe("useApiKeysStore", () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useApiKeysStore.setState({
      keys: {},
      configured: {},
      isLoaded: false,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it("starts with empty state", () => {
    const state = useApiKeysStore.getState();
    expect(state.keys).toEqual({});
    expect(state.configured).toEqual({});
    expect(state.isLoaded).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("fetchKeys populates keys and configured state", async () => {
    mockListKeys.mockResolvedValue({
      keys: [
        { provider: "openai", key_last_four: "ab12", updated_at: "2026-01-01T00:00:00Z" },
        { provider: "anthropic", key_last_four: "cd34", updated_at: "2026-01-02T00:00:00Z" },
      ],
    });
    mockDecryptKeys.mockResolvedValue({
      keys: { openai: "sk-openai-full-key", anthropic: "sk-ant-full-key" },
    });

    await useApiKeysStore.getState().fetchKeys();

    const state = useApiKeysStore.getState();
    expect(state.keys).toEqual({
      openai: "sk-openai-full-key",
      anthropic: "sk-ant-full-key",
    });
    expect(state.configured).toEqual({
      openai: { key_last_four: "ab12", updated_at: "2026-01-01T00:00:00Z" },
      anthropic: { key_last_four: "cd34", updated_at: "2026-01-02T00:00:00Z" },
    });
    expect(state.isLoaded).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it("hasKey returns true for configured providers", async () => {
    mockListKeys.mockResolvedValue({
      keys: [{ provider: "openai", key_last_four: "ab12", updated_at: "2026-01-01T00:00:00Z" }],
    });
    mockDecryptKeys.mockResolvedValue({
      keys: { openai: "sk-openai-full-key" },
    });

    await useApiKeysStore.getState().fetchKeys();

    expect(useApiKeysStore.getState().hasKey("openai")).toBe(true);
    expect(useApiKeysStore.getState().hasKey("anthropic")).toBe(false);
  });

  it("hasKey returns false before any fetch", () => {
    expect(useApiKeysStore.getState().hasKey("openai")).toBe(false);
    expect(useApiKeysStore.getState().hasKey("anthropic")).toBe(false);
  });

  it("clearKeys wipes all state", async () => {
    mockListKeys.mockResolvedValue({
      keys: [{ provider: "openai", key_last_four: "ab12", updated_at: "2026-01-01T00:00:00Z" }],
    });
    mockDecryptKeys.mockResolvedValue({
      keys: { openai: "sk-openai-full-key" },
    });

    await useApiKeysStore.getState().fetchKeys();
    expect(useApiKeysStore.getState().isLoaded).toBe(true);

    useApiKeysStore.getState().clearKeys();

    const state = useApiKeysStore.getState();
    expect(state.keys).toEqual({});
    expect(state.configured).toEqual({});
    expect(state.isLoaded).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("refreshKeys delegates to fetchKeys", async () => {
    mockListKeys.mockResolvedValue({
      keys: [{ provider: "anthropic", key_last_four: "zz99", updated_at: "2026-02-01T00:00:00Z" }],
    });
    mockDecryptKeys.mockResolvedValue({
      keys: { anthropic: "sk-ant-refreshed" },
    });

    await useApiKeysStore.getState().refreshKeys();

    const state = useApiKeysStore.getState();
    expect(state.keys.anthropic).toBe("sk-ant-refreshed");
    expect(state.configured.anthropic?.key_last_four).toBe("zz99");
    expect(mockListKeys).toHaveBeenCalledTimes(1);
    expect(mockDecryptKeys).toHaveBeenCalledTimes(1);
  });

  it("isLoading is true during fetch", async () => {
    let resolveList!: (v: unknown) => void;
    let resolveDecrypt!: (v: unknown) => void;

    mockListKeys.mockImplementation(
      () => new Promise((r) => { resolveList = r; }),
    );
    mockDecryptKeys.mockImplementation(
      () => new Promise((r) => { resolveDecrypt = r; }),
    );

    const fetchPromise = useApiKeysStore.getState().fetchKeys();
    expect(useApiKeysStore.getState().isLoading).toBe(true);

    resolveList({ keys: [] });
    resolveDecrypt({ keys: {} });
    await fetchPromise;

    expect(useApiKeysStore.getState().isLoading).toBe(false);
  });

  it("handles fetch errors gracefully", async () => {
    mockListKeys.mockRejectedValue(new Error("network error"));
    mockDecryptKeys.mockRejectedValue(new Error("network error"));

    await useApiKeysStore.getState().fetchKeys();

    const state = useApiKeysStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.isLoaded).toBe(false);
    expect(state.keys).toEqual({});
  });

  it("ignores unknown providers from API response", async () => {
    mockListKeys.mockResolvedValue({
      keys: [
        { provider: "openai", key_last_four: "ab12", updated_at: "2026-01-01T00:00:00Z" },
        { provider: "google", key_last_four: "xx00", updated_at: "2026-01-01T00:00:00Z" },
      ],
    });
    mockDecryptKeys.mockResolvedValue({
      keys: { openai: "sk-openai-key", google: "goog-key" },
    });

    await useApiKeysStore.getState().fetchKeys();

    const state = useApiKeysStore.getState();
    expect(state.keys).toEqual({ openai: "sk-openai-key" });
    expect(state.configured).toEqual({
      openai: { key_last_four: "ab12", updated_at: "2026-01-01T00:00:00Z" },
    });
  });

  it("skips null decrypted keys", async () => {
    mockListKeys.mockResolvedValue({
      keys: [{ provider: "openai", key_last_four: "ab12", updated_at: "2026-01-01T00:00:00Z" }],
    });
    mockDecryptKeys.mockResolvedValue({
      keys: { openai: null },
    });

    await useApiKeysStore.getState().fetchKeys();

    expect(useApiKeysStore.getState().keys).toEqual({});
    expect(useApiKeysStore.getState().hasKey("openai")).toBe(false);
  });
});
