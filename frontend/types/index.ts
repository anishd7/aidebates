// ─── Provider & Agent Config ────────────────────────────────────────────────

export type Provider = "openai" | "anthropic";

export interface AgentConfig {
  name: string;
  personality: string;
  provider: Provider;
  model: string;
}

// ─── Debates ────────────────────────────────────────────────────────────────

export type DebateStatus = "created" | "running" | "paused" | "completed";

export interface Debate {
  id: string;
  topic: string;
  agent_a_config: AgentConfig;
  agent_b_config: AgentConfig;
  status: DebateStatus;
  current_turn: number;
  max_turns: number;
  turns: Turn[];
  created_at: string;
  updated_at: string;
}

export interface DebateListItem {
  id: string;
  topic: string;
  status: DebateStatus;
  current_turn: number;
  max_turns: number;
  agent_a_name: string;
  agent_b_name: string;
  created_at: string;
  updated_at: string;
}

export interface DebateListResponse {
  debates: DebateListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateDebateRequest {
  topic: string;
  agent_a: AgentConfig;
  agent_b: AgentConfig;
  max_turns: number;
}

// ─── Turns ──────────────────────────────────────────────────────────────────

export type AgentSide = "a" | "b";

export interface Turn {
  turn_number: number;
  agent_name: string;
  agent_side: AgentSide;
  content: string;
  model_used: string;
  created_at: string;
}

// ─── API Keys ───────────────────────────────────────────────────────────────

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
}

export interface KeyInfo {
  provider: string;
  key_last_four: string;
  updated_at: string;
}

export interface KeyListResponse {
  keys: KeyInfo[];
}

export interface DecryptedKeysResponse {
  keys: Record<string, string | null>;
}

export interface SaveKeyRequest {
  provider: Provider;
  api_key: string;
}

export interface DeleteKeyResponse {
  deleted: boolean;
  provider: string;
}

// ─── SSE Events ─────────────────────────────────────────────────────────────

export interface SSEEvent {
  event: string;
  data: unknown;
}

export interface ParseResult {
  parsed: SSEEvent[];
  remaining: string;
}

export interface TurnStartData {
  turn: number;
  agent_name: string;
  agent_side: AgentSide;
  model: string;
}

export interface TokenData {
  text: string;
}

export interface TurnCompleteData {
  turn: number;
  agent_name: string;
  content: string;
  debate_status: DebateStatus;
  current_turn: number;
}

export interface ErrorData {
  code: string;
  provider?: string;
  message: string;
  recoverable: boolean;
}

// ─── Debate Manager (client-side state) ─────────────────────────────────────

export interface DebateMessage {
  turnNumber: number;
  agentName: string;
  agentSide: AgentSide;
  content: string;
  isStreaming: boolean;
}

export interface DebateError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface ActiveDebate {
  debateId: string;
  status: "running" | "paused" | "completed" | "error";
  messages: DebateMessage[];
  currentTurn: number;
  maxTurns: number;
  error?: DebateError;
  abortController: AbortController;
}

// ─── API Error ──────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

// ─── List Params ────────────────────────────────────────────────────────────

export interface ListDebatesParams {
  status?: DebateStatus;
  limit?: number;
  offset?: number;
}
