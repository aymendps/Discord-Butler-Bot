export type AIChatModel = "mistral:7b" | "llama3.2:3b" | "llama3.1:8b";
export type AIChatKeepAlive = "1m" | "2m" | "5m" | "0" | "-1";
export type AIChatMessageRole = "system" | "user" | "assistant";

export interface AIChatMessage {
  role: AIChatMessageRole;
  content: string;
}

export interface AIChatRequest {
  model: AIChatModel;
  messages: Array<AIChatMessage>;
  stream: boolean;
  keep_alive: AIChatKeepAlive;
}

export interface AIChatResponse {
  model: AIChatModel;
  created_at: string;
  message: AIChatMessage;
  done: boolean;
  done_reason: string;
  context: Array<number>;
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
  prompt_eval_duration: number;
  eval_count: number;
  eval_duration: number;
}
