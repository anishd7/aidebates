import { create } from "zustand";

import { fetchNextTurn, ApiRequestError } from "@/lib/api";
import { parseSSEEvents } from "@/lib/sse";
import { useApiKeysStore } from "@/stores/apiKeys";
import type {
  ActiveDebate,
  ApiKeys,
  DebateMessage,
  Turn,
  TurnStartData,
  TokenData,
  TurnCompleteData,
  ErrorData,
} from "@/types";

interface DebateManagerState {
  activeDebates: Record<string, ActiveDebate>;

  startDebate: (debateId: string, maxTurns: number) => void;
  resumeDebate: (
    debateId: string,
    existingTurns: Turn[],
    maxTurns: number,
  ) => void;
  pauseDebate: (debateId: string) => void;
  getDebate: (debateId: string) => ActiveDebate | undefined;
  clearDebate: (debateId: string) => void;
}

function turnsToMessages(turns: Turn[]): DebateMessage[] {
  return turns.map((t) => ({
    turnNumber: t.turn_number,
    agentName: t.agent_name,
    agentSide: t.agent_side,
    content: t.content,
    isStreaming: false,
  }));
}

async function runDebateLoop(
  debateId: string,
  apiKeys: ApiKeys,
  signal: AbortSignal,
  set: (
    fn: (state: DebateManagerState) => Partial<DebateManagerState>,
  ) => void,
  get: () => DebateManagerState,
) {
  const decoder = new TextDecoder();

  try {
    while (!signal.aborted) {
      let response: Response;

      try {
        response = await fetchNextTurn(debateId, apiKeys, signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err; // re-throw to outer catch
        }
        if (signal.aborted) {
          break;
        }
        if (err instanceof ApiRequestError) {
          if (err.status === 409) {
            // Another tab claimed the turn — retry immediately
            continue;
          }
          // Other API error — set error state
          set((state) => ({
            activeDebates: {
              ...state.activeDebates,
              [debateId]: {
                ...state.activeDebates[debateId],
                status: "error",
                error: {
                  code: err.code,
                  message: err.message,
                  recoverable: true,
                },
              },
            },
          }));
          return;
        }
        // Network error
        set((state) => ({
          activeDebates: {
            ...state.activeDebates,
            [debateId]: {
              ...state.activeDebates[debateId],
              status: "error",
              error: {
                code: "network_error",
                message:
                  err instanceof Error ? err.message : "Network error",
                recoverable: true,
              },
            },
          },
        }));
        return;
      }

      // 204 = debate completed
      if (response.status === 204) {
        set((state) => ({
          activeDebates: {
            ...state.activeDebates,
            [debateId]: {
              ...state.activeDebates[debateId],
              status: "completed",
            },
          },
        }));
        return;
      }

      // Read the SSE stream
      const body = response.body;
      if (!body) {
        set((state) => ({
          activeDebates: {
            ...state.activeDebates,
            [debateId]: {
              ...state.activeDebates[debateId],
              status: "error",
              error: {
                code: "no_body",
                message: "Response body is null",
                recoverable: true,
              },
            },
          },
        }));
        return;
      }

      const reader = body.getReader();
      let buffer = "";
      let debateCompleted = false;
      let debateErrored = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { parsed, remaining } = parseSSEEvents(buffer);
          buffer = remaining;

          for (const event of parsed) {
            switch (event.event) {
              case "turn_start": {
                const data = event.data as TurnStartData;
                set((state) => {
                  const debate = state.activeDebates[debateId];
                  if (!debate) return state;
                  return {
                    activeDebates: {
                      ...state.activeDebates,
                      [debateId]: {
                        ...debate,
                        messages: [
                          ...debate.messages,
                          {
                            turnNumber: data.turn,
                            agentName: data.agent_name,
                            agentSide: data.agent_side,
                            content: "",
                            isStreaming: true,
                          },
                        ],
                      },
                    },
                  };
                });
                break;
              }

              case "token": {
                const data = event.data as TokenData;
                set((state) => {
                  const debate = state.activeDebates[debateId];
                  if (!debate || debate.messages.length === 0) return state;
                  const messages = [...debate.messages];
                  const last = { ...messages[messages.length - 1] };
                  last.content += data.text;
                  messages[messages.length - 1] = last;
                  return {
                    activeDebates: {
                      ...state.activeDebates,
                      [debateId]: {
                        ...debate,
                        messages,
                      },
                    },
                  };
                });
                break;
              }

              case "turn_complete": {
                const data = event.data as TurnCompleteData;
                const isCompleted = data.debate_status === "completed";
                set((state) => {
                  const debate = state.activeDebates[debateId];
                  if (!debate || debate.messages.length === 0) return state;
                  const messages = [...debate.messages];
                  const last = { ...messages[messages.length - 1] };
                  last.content = data.content; // canonical version from server
                  last.isStreaming = false;
                  messages[messages.length - 1] = last;
                  return {
                    activeDebates: {
                      ...state.activeDebates,
                      [debateId]: {
                        ...debate,
                        messages,
                        currentTurn: data.current_turn,
                        status: isCompleted ? "completed" : debate.status,
                      },
                    },
                  };
                });
                if (isCompleted) {
                  debateCompleted = true;
                }
                break;
              }

              case "error": {
                const data = event.data as ErrorData;
                set((state) => ({
                  activeDebates: {
                    ...state.activeDebates,
                    [debateId]: {
                      ...state.activeDebates[debateId],
                      status: "error",
                      error: {
                        code: data.code,
                        message: data.message,
                        recoverable: data.recoverable,
                      },
                    },
                  },
                }));
                debateErrored = true;
                break;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (debateCompleted || debateErrored) {
        return;
      }
    }
  } catch (err) {
    // AbortError = user paused, not an error
    if (err instanceof DOMException && err.name === "AbortError") {
      return;
    }
    // Check if aborted (some environments throw different error types)
    if (signal.aborted) {
      return;
    }
    // Unexpected error
    set((state) => ({
      activeDebates: {
        ...state.activeDebates,
        [debateId]: {
          ...state.activeDebates[debateId],
          status: "error",
          error: {
            code: "unexpected_error",
            message: err instanceof Error ? err.message : "Unexpected error",
            recoverable: true,
          },
        },
      },
    }));
  }
}

export const useDebateManagerStore = create<DebateManagerState>(
  (set, get) => ({
    activeDebates: {},

    startDebate: (debateId: string, maxTurns: number) => {
      const abortController = new AbortController();
      const debate: ActiveDebate = {
        debateId,
        status: "running",
        messages: [],
        currentTurn: 0,
        maxTurns,
        abortController,
      };

      set((state) => ({
        activeDebates: {
          ...state.activeDebates,
          [debateId]: debate,
        },
      }));

      const apiKeys = useApiKeysStore.getState().keys;

      // Fire-and-forget the loop
      runDebateLoop(debateId, apiKeys, abortController.signal, set, get);
    },

    resumeDebate: (
      debateId: string,
      existingTurns: Turn[],
      maxTurns: number,
    ) => {
      const abortController = new AbortController();
      const debate: ActiveDebate = {
        debateId,
        status: "running",
        messages: turnsToMessages(existingTurns),
        currentTurn: existingTurns.length,
        maxTurns,
        abortController,
      };

      set((state) => ({
        activeDebates: {
          ...state.activeDebates,
          [debateId]: debate,
        },
      }));

      const apiKeys = useApiKeysStore.getState().keys;

      runDebateLoop(debateId, apiKeys, abortController.signal, set, get);
    },

    pauseDebate: (debateId: string) => {
      const debate = get().activeDebates[debateId];
      if (!debate) return;

      debate.abortController.abort();

      set((state) => ({
        activeDebates: {
          ...state.activeDebates,
          [debateId]: {
            ...state.activeDebates[debateId],
            status: "paused",
          },
        },
      }));
    },

    getDebate: (debateId: string) => {
      return get().activeDebates[debateId];
    },

    clearDebate: (debateId: string) => {
      const debate = get().activeDebates[debateId];
      if (debate) {
        debate.abortController.abort();
      }

      set((state) => {
        const { [debateId]: _, ...rest } = state.activeDebates;
        return { activeDebates: rest };
      });
    },
  }),
);
