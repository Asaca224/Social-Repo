import Anthropic from "@anthropic-ai/sdk";
import type { LLM } from "./ai";

/**
 * Anthropic-backed {@link LLM}. Uses Claude Haiku 4.5 for drafts and sentiment
 * (fast and cheap at inbox volume), per the product spec.
 *
 * Gated on ANTHROPIC_API_KEY: {@link getLLM} returns null when unset so routes
 * can respond 503 rather than crash, and the app runs without an AI key.
 */

// Haiku for inbox drafts/sentiment; Sonnet for report summaries (per spec).
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
export const REPORT_MODEL = process.env.ANTHROPIC_REPORT_MODEL ?? "claude-sonnet-5";

export function isAIEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

class AnthropicLLM implements LLM {
  private client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(input: {
    system?: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: input.maxTokens ?? 300,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });
    // Concatenate text blocks from the response.
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

/** The AI client, or null when ANTHROPIC_API_KEY is not configured. */
export function getLLM(model: string = DEFAULT_MODEL): LLM | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new AnthropicLLM(apiKey, model);
}
