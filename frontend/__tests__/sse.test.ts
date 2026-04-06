import { describe, it, expect } from "vitest";
import { parseSSEEvents } from "@/lib/sse";

describe("parseSSEEvents", () => {
  it("parses a single complete event", () => {
    const buffer = 'event: turn_start\ndata: {"turn":0,"agent_name":"Pro","agent_side":"a","model":"gpt-4.1"}\n\n';
    const { parsed, remaining } = parseSSEEvents(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].event).toBe("turn_start");
    expect(parsed[0].data).toEqual({
      turn: 0,
      agent_name: "Pro",
      agent_side: "a",
      model: "gpt-4.1",
    });
    expect(remaining).toBe("");
  });

  it("parses multiple events in one buffer", () => {
    const buffer = [
      'event: token',
      'data: {"text":"Hello "}',
      '',
      'event: token',
      'data: {"text":"world"}',
      '',
    ].join("\n");

    const { parsed, remaining } = parseSSEEvents(buffer);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].data).toEqual({ text: "Hello " });
    expect(parsed[1].data).toEqual({ text: "world" });
    expect(remaining).toBe("");
  });

  it("returns unparsed remainder for incomplete events", () => {
    const buffer = [
      'event: token',
      'data: {"text":"done"}',
      '',
      'event: turn_complete',
      'data: {"turn":0',
    ].join("\n");

    const { parsed, remaining } = parseSSEEvents(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].event).toBe("token");
    expect(remaining).toBe('event: turn_complete\ndata: {"turn":0');
  });

  it("handles JSON parsing of all event types", () => {
    const buffer = [
      'event: turn_complete',
      'data: {"turn":0,"agent_name":"Pro","content":"Full text","debate_status":"running","current_turn":1}',
      '',
      'event: error',
      'data: {"code":"invalid_api_key","provider":"openai","message":"Bad key","recoverable":true}',
      '',
    ].join("\n");

    const { parsed } = parseSSEEvents(buffer);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].event).toBe("turn_complete");
    expect(parsed[0].data.current_turn).toBe(1);
    expect(parsed[1].event).toBe("error");
    expect(parsed[1].data.recoverable).toBe(true);
  });

  it("defaults to 'message' event type when no event field", () => {
    const buffer = 'data: {"text":"no event field"}\n\n';
    const { parsed } = parseSSEEvents(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].event).toBe("message");
  });

  it("skips events with malformed JSON", () => {
    const buffer = [
      'event: token',
      'data: {not valid json}',
      '',
      'event: token',
      'data: {"text":"valid"}',
      '',
    ].join("\n");

    const { parsed } = parseSSEEvents(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].data).toEqual({ text: "valid" });
  });

  it("handles empty buffer", () => {
    const { parsed, remaining } = parseSSEEvents("");
    expect(parsed).toHaveLength(0);
    expect(remaining).toBe("");
  });

  it("handles multi-line data fields", () => {
    const buffer = [
      'event: token',
      'data: {"text":',
      'data: "hello"}',
      '',
    ].join("\n");

    const { parsed } = parseSSEEvents(buffer);

    // Multi-line data gets concatenated with newline
    expect(parsed).toHaveLength(1);
    expect(parsed[0].data).toEqual({ text: "hello" });
  });

  it("ignores comment lines", () => {
    const buffer = [
      ': this is a comment',
      'event: token',
      'data: {"text":"hi"}',
      '',
    ].join("\n");

    const { parsed } = parseSSEEvents(buffer);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].data).toEqual({ text: "hi" });
  });

  it("chains correctly across multiple chunks", () => {
    const chunk1 = 'event: token\ndata: {"text":"a"}\n\nevent: tok';
    const { parsed: p1, remaining: r1 } = parseSSEEvents(chunk1);
    expect(p1).toHaveLength(1);
    expect(r1).toBe("event: tok");

    const chunk2 = r1 + 'en\ndata: {"text":"b"}\n\n';
    const { parsed: p2, remaining: r2 } = parseSSEEvents(chunk2);
    expect(p2).toHaveLength(1);
    expect(p2[0].data).toEqual({ text: "b" });
    expect(r2).toBe("");
  });
});
