import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StreamingText from "@/components/debate/StreamingText";

describe("StreamingText", () => {
  it("renders markdown content when not streaming", () => {
    render(<StreamingText content="Hello **world**" isStreaming={false} />);
    expect(screen.getByText("world")).toBeTruthy();
    // No blinking cursor
    const cursor = document.querySelector(".animate-cursor-blink");
    expect(cursor).toBeNull();
  });

  it("renders content with blinking cursor when streaming", () => {
    render(<StreamingText content="Streaming text" isStreaming={true} />);
    expect(screen.getByText("Streaming text")).toBeTruthy();
    // Blinking cursor should be present
    const cursor = document.querySelector(".animate-cursor-blink");
    expect(cursor).not.toBeNull();
    expect(cursor).toBeTruthy();
  });

  it("renders markdown formatting correctly", () => {
    render(
      <StreamingText
        content={"- item one\n- item two\n- **bold item**"}
        isStreaming={false}
      />
    );
    expect(screen.getByText("item one")).toBeTruthy();
    expect(screen.getByText("item two")).toBeTruthy();
    expect(screen.getByText("bold item")).toBeTruthy();
  });

  it("removes cursor when streaming finishes", () => {
    const { rerender } = render(
      <StreamingText content="partial" isStreaming={true} />
    );
    expect(document.querySelector(".animate-cursor-blink")).not.toBeNull();

    rerender(<StreamingText content="partial complete" isStreaming={false} />);
    expect(document.querySelector(".animate-cursor-blink")).toBeNull();
  });

  it("renders empty content gracefully", () => {
    render(<StreamingText content="" isStreaming={true} />);
    const cursor = document.querySelector(".animate-cursor-blink");
    expect(cursor).not.toBeNull();
  });
});
