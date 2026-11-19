import { describe, expect, it } from "vitest";
import { isAiRenderMode, stagesForRenderMode } from "@/lib/processing-mode";

describe("submission mode separation", () => {
  it("shows no AI pipeline stage in SCENEIQ Engine mode", () => {
    const titles = stagesForRenderMode("system").map((stage) => stage.title).join(" ");
    const descriptions = stagesForRenderMode("system").map((stage) => stage.desc).join(" ");
    expect(titles).not.toMatch(/\bAI\b/i);
    expect(titles).toContain("Rule-Based Entity Mapping");
    expect(descriptions).toContain("no AI request");
  });

  it("shows AI extraction only in With AI Help mode", () => {
    const text = stagesForRenderMode("ai").map((stage) => stage.title).join(" ");
    expect(text).toContain("AI Entity & Event Extraction");
  });

  it("allows AI video only for With AI Help jobs", () => {
    expect(isAiRenderMode("system")).toBe(false);
    expect(isAiRenderMode("ai")).toBe(true);
    expect(isAiRenderMode(undefined)).toBe(false);
  });
});
