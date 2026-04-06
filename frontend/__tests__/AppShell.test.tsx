import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppShell from "@/components/layout/AppShell";

// Mock Header
const mockHeaderToggle = vi.fn();
vi.mock("@/components/layout/Header", () => ({
  default: ({ onToggleSidebar }: { onToggleSidebar?: () => void }) => {
    // Store the callback so tests can invoke it
    mockHeaderToggle.mockImplementation(() => onToggleSidebar?.());
    return (
      <header data-testid="header">
        <button data-testid="toggle-sidebar" onClick={onToggleSidebar}>
          Toggle
        </button>
      </header>
    );
  },
}));

// Mock Sidebar
const mockSidebarClose = vi.fn();
vi.mock("@/components/layout/Sidebar", () => ({
  default: ({ open, onClose }: { open?: boolean; onClose?: () => void }) => {
    mockSidebarClose.mockImplementation(() => onClose?.());
    return (
      <aside data-testid="sidebar" data-open={open}>
        <button data-testid="close-sidebar" onClick={onClose}>
          Close
        </button>
      </aside>
    );
  },
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Header, Sidebar, and children", () => {
    render(
      <AppShell>
        <div data-testid="content">Hello</div>
      </AppShell>
    );

    expect(screen.getByTestId("header")).toBeDefined();
    expect(screen.getByTestId("sidebar")).toBeDefined();
    expect(screen.getByTestId("content")).toBeDefined();
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("applies correct layout classes", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("flex");
    expect(root.className).toContain("h-screen");
    expect(root.className).toContain("flex-col");
    expect(root.className).toContain("bg-slate-50");
  });

  it("sidebar starts closed", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar.getAttribute("data-open")).toBe("false");
  });

  it("toggles sidebar open when header toggle is clicked", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const toggleBtn = screen.getByTestId("toggle-sidebar");
    await user.click(toggleBtn);

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar.getAttribute("data-open")).toBe("true");
  });

  it("closes sidebar when Sidebar onClose fires", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    // Open the sidebar first
    const toggleBtn = screen.getByTestId("toggle-sidebar");
    await user.click(toggleBtn);
    expect(screen.getByTestId("sidebar").getAttribute("data-open")).toBe(
      "true"
    );

    // Close it
    const closeBtn = screen.getByTestId("close-sidebar");
    await user.click(closeBtn);
    expect(screen.getByTestId("sidebar").getAttribute("data-open")).toBe(
      "false"
    );
  });

  it("toggles sidebar closed when header toggle is clicked twice", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const toggleBtn = screen.getByTestId("toggle-sidebar");
    await user.click(toggleBtn);
    expect(screen.getByTestId("sidebar").getAttribute("data-open")).toBe(
      "true"
    );

    await user.click(toggleBtn);
    expect(screen.getByTestId("sidebar").getAttribute("data-open")).toBe(
      "false"
    );
  });

  it("renders children inside main element", () => {
    render(
      <AppShell>
        <div data-testid="child">Child content</div>
      </AppShell>
    );

    const child = screen.getByTestId("child");
    const main = child.closest("main");
    expect(main).not.toBeNull();
    expect(main?.className).toContain("flex-1");
    expect(main?.className).toContain("overflow-y-auto");
  });
});
