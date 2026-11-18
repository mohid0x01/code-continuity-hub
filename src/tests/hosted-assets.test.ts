import { describe, expect, it } from "vitest";
import { selectHostedAssetUrl } from "@/lib/hosted-assets";

const hosted = "/__l5e/assets-v1/model.glb";
const local = "/assets/model-hash.glb";

describe("hosted asset deployment selection", () => {
  it("uses the bundled model on the reported Vercel domain", () => {
    expect(selectHostedAssetUrl(hosted, local, "scene-iq.teamcyberops.xyz")).toBe(local);
  });

  it("uses bundled models on Vercel preview deployments", () => {
    expect(selectHostedAssetUrl(hosted, local, "scene-iq-git-main.vercel.app")).toBe(local);
  });

  it("retains the CDN model on the Lovable primary domain", () => {
    expect(selectHostedAssetUrl(hosted, local, "scene-iq.dev")).toBe(hosted);
  });

  it("retains the CDN model on Lovable preview hosts", () => {
    expect(selectHostedAssetUrl(hosted, local, "id-preview--example.lovable.app")).toBe(hosted);
  });

  it("uses the bundled model during local development", () => {
    expect(selectHostedAssetUrl(hosted, local, "localhost", true)).toBe(local);
  });
});
