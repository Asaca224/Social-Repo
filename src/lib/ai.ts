import type { Sentiment } from "@prisma/client";

/**
 * AI features (Phase 4): draft reply suggestions and sentiment tagging.
 *
 * Human-in-the-loop by design — per the product spec, AI drafts and a person
 * sends. Nothing here sends a reply; `draftReply` only returns suggested text.
 *
 * The model call is abstracted behind {@link LLM} so prompt construction and
 * output parsing are unit-tested with a fake, and the concrete Anthropic-backed
 * implementation (src/lib/anthropic.ts) is swapped in at the route.
 */

export interface LLM {
  complete(input: {
    system?: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string>;
}

export interface DraftReplyArgs {
  commentBody: string;
  authorName: string;
  /** Optional brand voice / guidance for this client. */
  brandVoice?: string;
}

const REPLY_SYSTEM =
  "You draft short, friendly, on-brand replies to social media comments for a " +
  "brand's account. Reply in 1-2 sentences. Be helpful and professional. " +
  "Never invent facts, prices, or promises. Output only the reply text, with no " +
  "quotes or preamble.";

export function buildReplyPrompt(args: DraftReplyArgs): {
  system: string;
  prompt: string;
} {
  const voice = args.brandVoice
    ? `\nBrand voice: ${args.brandVoice}`
    : "";
  return {
    system: REPLY_SYSTEM + voice,
    prompt: `Comment from ${args.authorName}:\n"${args.commentBody}"\n\nDraft a reply:`,
  };
}

/** Draft a reply suggestion. Returns text only; sending stays with a human. */
export async function draftReply(
  llm: LLM,
  args: DraftReplyArgs,
): Promise<string> {
  const { system, prompt } = buildReplyPrompt(args);
  const text = await llm.complete({ system, prompt, maxTokens: 300 });
  return text.trim();
}

const SENTIMENT_SYSTEM =
  "You classify the sentiment of a social media comment as exactly one word: " +
  "positive, neutral, or negative. Output only that one word.";

/** Map free-form model output to a {@link Sentiment}; defaults to neutral. */
export function parseSentiment(raw: string): Sentiment {
  const text = raw.toLowerCase();
  if (/\bnegative\b/.test(text)) return "negative";
  if (/\bpositive\b/.test(text)) return "positive";
  return "neutral";
}

/** Classify a comment's sentiment. */
export async function classifySentiment(
  llm: LLM,
  commentBody: string,
): Promise<Sentiment> {
  const text = await llm.complete({
    system: SENTIMENT_SYSTEM,
    prompt: `Comment:\n"${commentBody}"\n\nSentiment:`,
    maxTokens: 8,
  });
  return parseSentiment(text);
}
