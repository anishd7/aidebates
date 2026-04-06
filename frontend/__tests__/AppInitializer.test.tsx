import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import AppInitializer from "@/components/layout/AppInitializer";
import { useApiKeysStore } from "@/stores/apiKeys";

// Mock the API calls that fetchKeys depends on
vi.mock("@/lib/api", () => ({
  listKeys: vi.fn().mockResolvedValue({ keys: [] }),
  decryptKeys: vi.fn().mockResolvedValue({ keys: {} }),
}));

describe("AppInitializer", () => {
  beforeEach(() => {
    // Reset the zustand store between tests
    useApiKeysStore.setState({
      keys: {},
      configured: {},
      isLoaded: false,
      isLoading: false,
    });
  });

  it("renders nothing (returns null)", () => {
    const { container } = render(<AppInitializer />);
    expect(container.innerHTML).toBe("");
  });

  it("calls fetchKeys on mount when keys are not loaded", async () => {
    const fetchKeysSpy = vi.fn();
    useApiKeysStore.setState({ isLoaded: false, fetchKeys: fetchKeysSpy });

    render(<AppInitializer />);

    expect(fetchKeysSpy).toHaveBeenCalledOnce();
  });

  it("does not call fetchKeys when keys are already loaded", () => {
    const fetchKeysSpy = vi.fn();
    useApiKeysStore.setState({ isLoaded: true, fetchKeys: fetchKeysSpy });

    render(<AppInitializer />);

    expect(fetchKeysSpy).not.toHaveBeenCalled();
  });
});
