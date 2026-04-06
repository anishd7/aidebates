import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("NEXT_REDIRECT"); // redirect() throws in Next.js
  },
  usePathname: vi.fn(() => "/app"),
}));

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock AppShell
vi.mock("@/components/layout/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

// Mock AppInitializer
vi.mock("@/components/layout/AppInitializer", () => ({
  default: () => <div data-testid="app-initializer" />,
}));

import AppLayout from "@/app/(app)/layout";

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when there is no session", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      AppLayout({ children: <div>Content</div> })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null });

    await expect(
      AppLayout({ children: <div>Content</div> })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("renders AppShell with children when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { name: "Test User", email: "test@example.com" },
    });

    const result = await AppLayout({
      children: <div data-testid="page-content">Hello</div>,
    });

    // The result should be a React element tree containing AppShell and AppInitializer
    // We verify the structure by checking the rendered JSX
    expect(result).toBeTruthy();

    // Render to verify structure
    const { render, screen } = await import("@testing-library/react");
    render(result as React.ReactElement);

    expect(screen.getByTestId("app-shell")).toBeDefined();
    expect(screen.getByTestId("app-initializer")).toBeDefined();
    expect(screen.getByTestId("page-content")).toBeDefined();
    expect(screen.getByText("Hello")).toBeDefined();
  });
});
