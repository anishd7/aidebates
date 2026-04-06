import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "@/components/layout/Header";

// Mock next-auth/react
const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        name: "Jane Doe",
        email: "jane@example.com",
        image: "https://example.com/avatar.jpg",
      },
    },
    status: "authenticated",
  })),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the app logo/name", () => {
    render(<Header />);
    expect(screen.getByText("AI Debate Arena")).toBeDefined();
  });

  it("renders user avatar with initials fallback", () => {
    render(<Header />);
    // In happy-dom, AvatarImage doesn't load so fallback shows
    expect(screen.getByText("JD")).toBeDefined();
  });

  it("shows dropdown menu with user info, settings, and sign out", async () => {
    const user = userEvent.setup();
    render(<Header />);

    // Click the avatar trigger button (accessible name comes from fallback initials)
    const avatarButton = screen.getByRole("button", { name: /jd/i });
    await user.click(avatarButton);

    // User info
    expect(screen.getByText("Jane Doe")).toBeDefined();
    expect(screen.getByText("jane@example.com")).toBeDefined();

    // Settings link
    const settingsLink = screen.getByText("Settings");
    expect(settingsLink.closest("a")?.getAttribute("href")).toBe(
      "/app/settings"
    );

    // Sign Out button
    expect(screen.getByText("Sign Out")).toBeDefined();
  });

  it("calls signOut when Sign Out is clicked", async () => {
    const user = userEvent.setup();
    render(<Header />);

    const avatarButton = screen.getByRole("button", { name: /jd/i });
    await user.click(avatarButton);

    const signOutItem = screen.getByText("Sign Out");
    await user.click(signOutItem);

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("renders hamburger button on mobile when onToggleSidebar provided", () => {
    const onToggle = vi.fn();
    render(<Header onToggleSidebar={onToggle} />);

    const hamburger = screen.getByLabelText("Toggle sidebar");
    expect(hamburger).toBeDefined();
  });

  it("calls onToggleSidebar when hamburger is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Header onToggleSidebar={onToggle} />);

    const hamburger = screen.getByLabelText("Toggle sidebar");
    await user.click(hamburger);

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("does not render hamburger when onToggleSidebar is not provided", () => {
    render(<Header />);
    expect(screen.queryByLabelText("Toggle sidebar")).toBeNull();
  });

  it("does not render avatar dropdown when not authenticated", async () => {
    const { useSession } = await import("next-auth/react");
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    render(<Header />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
