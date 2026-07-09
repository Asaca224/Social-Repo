import { describe, expect, it, vi } from "vitest";
import {
  buildReplyPrompt,
  classifySentiment,
  draftReply,
  parseSentiment,
  type LLM,
} from "@/lib/ai";

function fakeLLM(reply: string): LLM {
  return { complete: vi.fn(async () => reply) };
}

describe("buildReplyPrompt", () => {
  it("includes the author and comment, and brand voice when given", () => {
    const { system, prompt } = buildReplyPrompt({
      commentBody: "Love this!",
      authorName: "Sam",
      brandVoice: "playful and concise",
    });
    expect(prompt).toContain("Sam");
    expect(prompt).toContain("Love this!");
    expect(system).toContain("playful and concise");
  });

  it("omits brand voice when not provided", () => {
    const { system } = buildReplyPrompt({ commentBody: "hi", authorName: "A" });
    expect(system).not.toContain("Brand voice:");
  });
});

describe("draftReply", () => {
  it("returns trimmed model text and never sends", async () => {
    const llm = fakeLLM("  Thanks so much!  ");
    const draft = await draftReply(llm, { commentBody: "Great!", authorName: "Sam" });
    expect(draft).toBe("Thanks so much!");
    expect(llm.complete).toHaveBeenCalledOnce();
  });
});

describe("parseSentiment", () => {
  it("maps model output to the enum", () => {
    expect(parseSentiment("negative")).toBe("negative");
    expect(parseSentiment("Positive.")).toBe("positive");
    expect(parseSentiment("NEUTRAL")).toBe("neutral");
  });

  it("defaults to neutral on anything unrecognized", () => {
    expect(parseSentiment("I'm not sure")).toBe("neutral");
    expect(parseSentiment("")).toBe("neutral");
  });

  it("prefers negative when the word appears", () => {
    expect(parseSentiment("this is negative sentiment")).toBe("negative");
  });
});

describe("classifySentiment", () => {
  it("classifies via the LLM and parses the result", async () => {
    expect(await classifySentiment(fakeLLM("negative"), "This is terrible")).toBe("negative");
    expect(await classifySentiment(fakeLLM("positive"), "Amazing!")).toBe("positive");
  });
});
