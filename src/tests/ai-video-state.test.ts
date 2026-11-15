import { describe, expect, it } from "vitest";
import { isAiVideoProcessing, resolveAiPollResult } from "@/lib/ai-video-state";

describe("AI video viewer state", () => {
  it("turns an incomplete saved render into a visible terminal error", () => {
    const state = resolveAiPollResult({ status: "none" });
    expect(state.status).toBe("ai_failed");
    expect(state.error).toContain("no provider job");
  });

  it("preserves a provider refusal as terminal with its original message", () => {
    const message = "output blocked by safety filters";
    const state = resolveAiPollResult({ status: "ai_failed", error: message });
    expect(state).toEqual({ status: "ai_failed", error: message });
    expect(isAiVideoProcessing(state.status)).toBe(false);
  });

  it("continues polling only for active processing states", () => {
    expect(isAiVideoProcessing("processing")).toBe(true);
    expect(isAiVideoProcessing("ai_processing")).toBe(true);
    expect(isAiVideoProcessing("completed")).toBe(false);
    expect(isAiVideoProcessing("ai_failed")).toBe(false);
  });
});
