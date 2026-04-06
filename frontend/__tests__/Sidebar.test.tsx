import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/layout/Sidebar";
import type { DebateListItem } from "@/types";

// Mock next/navigation
const mockPathname = vi.fn(() => "/app");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

// Mock listDebates
const mockListDebates = vi.fn();
vi.mock("@/lib/api", () => ({
  listDebates: (...args: unknown[]) => mockListDebates(...args),
}));

// Mock debate manager store
const mockGetDebate = vi.fn(() => undefined);
vi.mock("@/stores/debateManager", () => ({
  useDebateManagerStore: (selector: (s: { getDebate: typeof mockGetDebate }) => unknown) =>
    selector({ getDebate: mockGetDebate }),
}));

const sampleDebates: DebateListItem[] = [
  {
    id: "debate-1",
    topic: "Should AI be regulated?",
    status: "running",
    current_turn: 3,
    max_turns: 6,
    agent_a_name: "Pro AI",
    agent_b_name: "Anti AI",
    created_at: "2026-04-01T10:00:00Z",
    updated_at: "2026-04-01T10:05:00Z",
  },
  {
    id: "debate-2",
    topic: "Is remote work better than office work for long term productivity?",
    status: "completed",
    current_turn: 6,
    max_turns: 6,
    agent_a_name: "Remote Fan",
    agent_b_name: "Office Fan",
    created_at: "2026-03-30T08:00:00Z",
    updated_at: "2026-03-30T09:00:00Z",
  },
  {
    id: "debate-3",
    topic: "Pineapple on pizza",
    status: "paused",
    current_turn: 2,
    max_turns: 4,
    agent_a_name: "Chef A",
    agent_b_name: "Chef B",
    created_at: "2026-03-29T12:00:00Z",
    updated_at: "2026-03-29T12:30:00Z",
  },
  {
    id: "debate-4",
    topic: "Space exploration",
    status: "created",
    current_turn: 0,
    max_turns: 6,
    agent_a_name: "Explorer",
    agent_b_name: "Skeptic",
    created_at: "2026-03-28T12:00:00Z",
    updated_at: "2026-03-28T12:00:00Z",
  },
];

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/app");
    mockListDebates.mockResolvedValue({ debates: sampleDebates, total: 4, limit: 50, offset: 0 });
    mockGetDebate.mockReturnValue(undefined);
  });

  it("renders the New Debate button linking to /app/new", async () => {
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("New Debate")).toBeDefined();
    });
    const link = screen.getByText("New Debate").closest("a");
    expect(link?.getAttribute("href")).toBe("/app/new");
  });

  it("fetches and displays debate list", async () => {
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("Should AI be regulated?")).toBeDefined();
    });
    expect(screen.getByText("Pro AI vs Anti AI")).toBeDefined();
    expect(screen.getByText("Pineapple on pizza")).toBeDefined();
    expect(screen.getByText("Chef A vs Chef B")).toBeDefined();
  });

  it("truncates long topic names", async () => {
    render(<Sidebar />);
    await waitFor(() => {
      // "Is remote work better than office work for long term productivity?" is > 40 chars
      expect(screen.getByText("Is remote work better than office work f...")).toBeDefined();
    });
  });

  it("highlights the active debate based on pathname", async () => {
    mockPathname.mockReturnValue("/app/debate/debate-1");
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("Should AI be regulated?")).toBeDefined();
    });
    const activeLink = screen.getByText("Should AI be regulated?").closest("a");
    expect(activeLink?.className).toContain("bg-slate-100");
    expect(activeLink?.className).toContain("text-slate-900");
  });

  it("shows correct status indicators for each status", async () => {
    const { container } = render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("Should AI be regulated?")).toBeDefined();
    });
    // We'll check the desktop sidebar (first aside)
    const aside = container.querySelector("aside");
    expect(aside).toBeDefined();

    // Running: pulsing green dot (has animate-ping child)
    const runningLink = screen.getByText("Should AI be regulated?").closest("a")!;
    const pulsingDot = runningLink.querySelector(".animate-ping");
    expect(pulsingDot).not.toBeNull();

    // Completed: check icon (svg)
    const completedLink = screen.getByText("Is remote work better than office work f...").closest("a")!;
    const checkIcon = completedLink.querySelector("svg");
    expect(checkIcon).not.toBeNull();

    // Paused: yellow dot
    const pausedLink = screen.getByText("Pineapple on pizza").closest("a")!;
    const yellowDot = pausedLink.querySelector(".bg-yellow-500");
    expect(yellowDot).not.toBeNull();

    // Created: blue dot
    const createdLink = screen.getByText("Space exploration").closest("a")!;
    const blueDot = createdLink.querySelector(".bg-blue-500");
    expect(blueDot).not.toBeNull();
  });

  it("shows empty state when no debates", async () => {
    mockListDebates.mockResolvedValue({ debates: [], total: 0, limit: 50, offset: 0 });
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("No debates yet")).toBeDefined();
    });
  });

  it("calls listDebates on mount", async () => {
    render(<Sidebar />);
    await waitFor(() => {
      expect(mockListDebates).toHaveBeenCalledWith({ limit: 50 });
    });
  });

  it("navigates to debate when clicked", async () => {
    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText("Pineapple on pizza")).toBeDefined();
    });
    const link = screen.getByText("Pineapple on pizza").closest("a");
    expect(link?.getAttribute("href")).toBe("/app/debate/debate-3");
  });

  it("renders mobile sheet when open prop is true", async () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      // Sheet renders content — we should see the New Debate button twice (desktop + mobile)
      const newDebateLinks = screen.getAllByText("New Debate");
      expect(newDebateLinks.length).toBe(2);
    });
  });

  it("calls onClose when mobile sheet navigation occurs", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Sidebar open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getAllByText("Pineapple on pizza").length).toBeGreaterThan(0);
    });

    // Click a debate in the mobile sheet (the second instance, inside the Sheet)
    const debateLinks = screen.getAllByText("Pineapple on pizza");
    const mobileLink = debateLinks[debateLinks.length - 1];
    await user.click(mobileLink);

    expect(onClose).toHaveBeenCalled();
  });

  it("handles listDebates failure gracefully", async () => {
    mockListDebates.mockRejectedValue(new Error("Network error"));
    render(<Sidebar />);
    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByText("New Debate")).toBeDefined();
    });
  });
});
