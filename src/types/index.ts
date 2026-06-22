// All shared types for jousting.

export type Provider =
  | "anthropic"
  | "openai"
  | "gemini"
  | "groq"
  | "openrouter"
  | "ollama";

export type Mode = "debate" | "redteam" | "review" | "synthesis" | "plan";

export type LanceStyle = "aggressive" | "methodical" | "socratic";

export type Scoring = "strict" | "lenient" | "narrative";

export type HitType = "direct" | "glancing" | "miss" | "unseat";

export type TournamentFormat = "elimination" | "roundrobin";

export interface TiltyardConfig {
  topic: string;
  passes: number;
  mode: Mode;
  save: boolean;
}

export interface AgentConfig {
  name: string;
  model: string;
  provider: Provider;
  lance_style: LanceStyle;
  persona: string;
}

export interface HeraldConfig {
  model: string;
  provider: Provider;
  scoring: Scoring;
  synthesize: boolean;
}

export interface TournamentConfig {
  format: TournamentFormat;
  agents: AgentConfig[];
}

export interface JoustConfig {
  tiltyard: TiltyardConfig;
  agent_a: AgentConfig;
  agent_b: AgentConfig;
  herald: HeraldConfig;
  tournament?: TournamentConfig;
}

// A single agent's output in one pass.
export interface Payload {
  agent: string;
  payload: string;
}

// Herald scoring for one side in a pass.
export interface SideScore {
  hit: HitType;
  reasoning: string;
}

// Full Herald score object for a pass.
export interface PassScore {
  pass: number;
  scores: {
    a: SideScore;
    b: SideScore;
  };
  unseat: boolean;
  unseated_agent: string | null;
  commentary: string;
}

// One completed pass in the joust.
export interface PassRecord {
  pass: number;
  a: Payload;
  b: Payload;
  score: PassScore;
}

// Final synthesis / result.
export interface JoustResult {
  winner: string;
  synthesis: string;
  total_hits: {
    a: number;
    b: number;
  };
}

// The serialized .joust file.
export interface JoustFile {
  id: string;
  version: string;
  created_at: string;
  config: JoustConfig;
  passes: PassRecord[];
  result: JoustResult;
}

// A mode module's contract.
export interface ModeModule {
  name: Mode;
  systemPromptA(config: JoustConfig): string;
  systemPromptB(config: JoustConfig): string;
  // The Herald needs config (names, scoring style) plus the running history.
  heraldPrompt(config: JoustConfig, passHistory: PassRecord[]): string;
  firstMoverInstructions: string;
}

// What an LLM adapter must implement.
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMAdapter {
  provider: Provider;
  complete(req: CompletionRequest): Promise<string>;
}
