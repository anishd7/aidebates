import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDebateManagerStore } from "@/stores/debateManager";

// Mock the apiKeys store
vi.mock("@/stores/apiKeys", () => ({
  useApiKeysStore: {
    getState: () => ({
      keys: { openai: "sk-test-key" },
    }),
  },
}));

// Mock the API module
vi.mock("@/lib/api", () => ({
  fetchNextTurn: vi.fn(),
  ApiRequestError: class ApiRequestError extends Error {
    status: number;
    code: string;
    constructor({
      status,
      code,
      message,
    }: {
      status: number;
      code: string;
      message: string;
    }) {
      super(message);
      this.name = "ApiRequestError";
      this.status = status;
      this.code = code;
    }
  },
}));

import { fetchNextTurn, ApiRequestError } from "@/lib/api";

const mockFetchNextTurn = vi.mocked(fetchNextTurn);

function resetStore() {
  useDebateManagerStore.setState({ activeDebates: {} });
}

/**
 * Creates a mock ReadableStream from SSE text.
 */
function createSSEStream(sseText: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
}

/**
 * Creates a mock Response with an SSE body.
 */
function createSSEResponse(sseText: string): Response {
  return {
    ok: true,
    status: 200,
    body: createSSEStream(sseText),
  } as unknown as Response;
}

/**
 * Wait for async loop to process.
 */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("useDebateManagerStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("starts with empty activeDebates", () => {
    const state = useDebateManagerStore.getState();
    expect(state.activeDebates).toEqual({});
  });

  it("startDebate creates an ActiveDebate with status='running' and empty messages", async () => {
    // Make fetchNextTurn return 204 (completed) immediately
    mockFetchNextTurn.mockResolvedValue({
      ok: true,
      status: 204,
      body: null,
    } as unknown as Response);

    useDebateManagerStore.getState().startDebate("debate-1", 6);

    const debate = useDebateManagerStore.getState().activeDebates["debate-1"];
    expect(debate).toBeDefined();
    expect(debate.status).toBe("running");
    expect(debate.messages).toEqual([]);
    expect(debate.currentTurn).toBe(0);
    expect(debate.maxTurns).toBe(6);
    expect(debate.debateId).toBe("debate-1");

    await flushPromises();
  });

  it("resumeDebate initializes messages from existing turns", async () => {
    mockFetchNextTurn.mockResolvedValue({
      ok: true,
      status: 204,
      body: null,
    } as unknown as Response);

    const existingTurns = [
      {
        turn_number: 1,
        agent_name: "Agent A",
        agent_side: "a" as const,
        content: "Hello from A",
        model_used: "gpt-4o",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        turn_number: 2,
        agent_name: "Agent B",
        agent_side: "b" as const,
        content: "Hello from B",
        model_used: "claude-sonnet-4-20250514",
        created_at: "2026-01-01T00:01:00Z",
      },
    ];

    useDebateManagerStore.getState().resumeDebate("debate-2", existingTurns, 6);

    const debate = useDebateManagerStore.getState().activeDebates["debate-2"];
    expect(debate.status).toBe("running");
    expect(debate.messages).toHaveLength(2);
    expect(debate.messages[0]).toEqual({
      turnNumber: 1,
      agentName: "Agent A",
      agentSide: "a",
      content: "Hello from A",
      isStreaming: false,
    });
    expect(debate.messages[1]).toEqual({
      turnNumber: 2,
      agentName: "Agent B",
      agentSide: "b",
      content: "Hello from B",
      isStreaming: false,
    });
    expect(debate.currentTurn).toBe(2);

    await flushPromises();
  });

  it("pauseDebate aborts the controller and sets status='paused'", async () => {
    mockFetchNextTurn.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    useDebateManagerStore.getState().startDebate("debate-3", 6);

    const debateBefore =
      useDebateManagerStore.getState().activeDebates["debate-3"];
    expect(debateBefore.status).toBe("running");

    useDebateManagerStore.getState().pauseDebate("debate-3");

    const debateAfter =
      useDebateManagerStore.getState().activeDebates["debate-3"];
    expect(debateAfter.status).toBe("paused");
    expect(debateBefore.abortController.signal.aborted).toBe(true);
  });

  it("getDebate returns the debate or undefined", () => {
    expect(useDebateManagerStore.getState().getDebate("nope")).toBeUndefined();

    mockFetchNextTurn.mockImplementation(() => new Promise(() => {}));
    useDebateManagerStore.getState().startDebate("debate-4", 6);

    const debate = useDebateManagerStore.getState().getDebate("debate-4");
    expect(debate).toBeDefined();
    expect(debate!.debateId).toBe("debate-4");
  });

  it("clearDebate removes the debate from activeDebates", () => {
    mockFetchNextTurn.mockImplementation(() => new Promise(() => {}));
    useDebateManagerStore.getState().startDebate("debate-5", 6);

    expect(
      useDebateManagerStore.getState().activeDebates["debate-5"],
    ).toBeDefined();

    useDebateManagerStore.getState().clearDebate("debate-5");

    expect(
      useDebateManagerStore.getState().activeDebates["debate-5"],
    ).toBeUndefined();
  });

  it("handles SSE turn_start, token, and turn_complete events", async () => {
    const sseText = [
      'event: turn_start',
      'data: {"turn": 1, "agent_name": "Agent A", "agent_side": "a", "model": "gpt-4o"}',
      '',
      'event: token',
      'data: {"text": "Hello "}',
      '',
      'event: token',
      'data: {"text": "world"}',
      '',
      'event: turn_complete',
      'data: {"turn": 1, "agent_name": "Agent A", "content": "Hello world", "debate_status": "completed", "current_turn": 1}',
      '',
    ].join('\n');

    mockFetchNextTurn.mockResolvedValueOnce(createSSEResponse(sseText));

    useDebateManagerStore.getState().startDebate("debate-sse", 6);
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-sse"];
    expect(debate.status).toBe("completed");
    expect(debate.messages).toHaveLength(1);
    expect(debate.messages[0]).toEqual({
      turnNumber: 1,
      agentName: "Agent A",
      agentSide: "a",
      content: "Hello world", // canonical from turn_complete
      isStreaming: false,
    });
    expect(debate.currentTurn).toBe(1);
  });

  it("accumulates tokens sequentially", async () => {
    const sseText = [
      'event: turn_start',
      'data: {"turn": 1, "agent_name": "Bot", "agent_side": "a", "model": "gpt-4o"}',
      '',
      'event: token',
      'data: {"text": "one "}',
      '',
      'event: token',
      'data: {"text": "two "}',
      '',
      'event: token',
      'data: {"text": "three"}',
      '',
      'event: turn_complete',
      'data: {"turn": 1, "agent_name": "Bot", "content": "one two three", "debate_status": "completed", "current_turn": 1}',
      '',
    ].join('\n');

    mockFetchNextTurn.mockResolvedValueOnce(createSSEResponse(sseText));

    useDebateManagerStore.getState().startDebate("debate-tokens", 2);
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-tokens"];
    expect(debate.messages[0].content).toBe("one two three");
  });

  it("handles debate completion via 204 status", async () => {
    mockFetchNextTurn.mockResolvedValueOnce({
      ok: true,
      status: 204,
      body: null,
    } as unknown as Response);

    useDebateManagerStore.getState().startDebate("debate-204", 6);
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-204"];
    expect(debate.status).toBe("completed");
  });

  it("handles error SSE events", async () => {
    const sseText = [
      'event: error',
      'data: {"code": "invalid_api_key", "message": "Bad key", "recoverable": true}',
      '',
    ].join('\n');

    mockFetchNextTurn.mockResolvedValueOnce(createSSEResponse(sseText));

    useDebateManagerStore.getState().startDebate("debate-err", 6);
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-err"];
    expect(debate.status).toBe("error");
    expect(debate.error).toEqual({
      code: "invalid_api_key",
      message: "Bad key",
      recoverable: true,
    });
  });

  it("retries on 409 response", async () => {
    // First call throws 409, second returns 204
    const err409 = new (ApiRequestError as unknown as new (opts: {
      status: number;
      code: string;
      message: string;
    }) => Error & { status: number; code: string })({
      status: 409,
      code: "conflict",
      message: "Turn already claimed",
    });
    (err409 as unknown as { status: number }).status = 409;
    (err409 as unknown as { code: string }).code = "conflict";

    mockFetchNextTurn
      .mockRejectedValueOnce(err409)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        body: null,
      } as unknown as Response);

    useDebateManagerStore.getState().startDebate("debate-409", 6);
    await flushPromises();

    expect(mockFetchNextTurn).toHaveBeenCalledTimes(2);
    const debate =
      useDebateManagerStore.getState().activeDebates["debate-409"];
    expect(debate.status).toBe("completed");
  });

  it("handles network errors with recoverable=true", async () => {
    mockFetchNextTurn.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    useDebateManagerStore.getState().startDebate("debate-net", 6);
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-net"];
    expect(debate.status).toBe("error");
    expect(debate.error).toEqual({
      code: "network_error",
      message: "Failed to fetch",
      recoverable: true,
    });
  });

  it("AbortError from pause does not set error state", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");

    mockFetchNextTurn.mockRejectedValueOnce(abortError);

    useDebateManagerStore.getState().startDebate("debate-abort", 6);

    // Pause immediately
    useDebateManagerStore.getState().pauseDebate("debate-abort");
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-abort"];
    expect(debate.status).toBe("paused");
    expect(debate.error).toBeUndefined();
  });

  it("supports multiple concurrent debates", async () => {
    mockFetchNextTurn.mockImplementation(() => new Promise(() => {}));

    useDebateManagerStore.getState().startDebate("d1", 4);
    useDebateManagerStore.getState().startDebate("d2", 8);

    const state = useDebateManagerStore.getState();
    expect(state.activeDebates["d1"]).toBeDefined();
    expect(state.activeDebates["d2"]).toBeDefined();
    expect(state.activeDebates["d1"].maxTurns).toBe(4);
    expect(state.activeDebates["d2"].maxTurns).toBe(8);
    expect(state.activeDebates["d1"].debateId).toBe("d1");
    expect(state.activeDebates["d2"].debateId).toBe("d2");
  });

  it("handles multi-turn debate loop", async () => {
    const turn1SSE = [
      'event: turn_start',
      'data: {"turn": 1, "agent_name": "A", "agent_side": "a", "model": "gpt-4o"}',
      '',
      'event: token',
      'data: {"text": "Turn 1"}',
      '',
      'event: turn_complete',
      'data: {"turn": 1, "agent_name": "A", "content": "Turn 1", "debate_status": "running", "current_turn": 1}',
      '',
    ].join('\n');

    const turn2SSE = [
      'event: turn_start',
      'data: {"turn": 2, "agent_name": "B", "agent_side": "b", "model": "claude-sonnet-4-20250514"}',
      '',
      'event: token',
      'data: {"text": "Turn 2"}',
      '',
      'event: turn_complete',
      'data: {"turn": 2, "agent_name": "B", "content": "Turn 2", "debate_status": "completed", "current_turn": 2}',
      '',
    ].join('\n');

    mockFetchNextTurn
      .mockResolvedValueOnce(createSSEResponse(turn1SSE))
      .mockResolvedValueOnce(createSSEResponse(turn2SSE));

    useDebateManagerStore.getState().startDebate("debate-multi", 2);
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-multi"];
    expect(debate.status).toBe("completed");
    expect(debate.messages).toHaveLength(2);
    expect(debate.messages[0].agentName).toBe("A");
    expect(debate.messages[0].agentSide).toBe("a");
    expect(debate.messages[1].agentName).toBe("B");
    expect(debate.messages[1].agentSide).toBe("b");
    expect(debate.currentTurn).toBe(2);
  });

  it("handles API error (non-409) with error state", async () => {
    const apiErr = new (ApiRequestError as unknown as new (opts: {
      status: number;
      code: string;
      message: string;
    }) => Error & { status: number; code: string })({
      status: 401,
      code: "unauthorized",
      message: "Not authorized",
    });
    (apiErr as unknown as { status: number }).status = 401;
    (apiErr as unknown as { code: string }).code = "unauthorized";

    mockFetchNextTurn.mockRejectedValueOnce(apiErr);

    useDebateManagerStore.getState().startDebate("debate-401", 6);
    await flushPromises();

    const debate =
      useDebateManagerStore.getState().activeDebates["debate-401"];
    expect(debate.status).toBe("error");
    expect(debate.error!.code).toBe("unauthorized");
    expect(debate.error!.recoverable).toBe(true);
  });
});
