import { describe, expect, it } from "vitest";
import { oauthReturnPath } from "@/lib/oauth-return-path";

describe("oauthReturnPath", () => {
  it("preserves a same-origin consent path with its authorization ID", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc123#decision")).toBe(
      "/.lovable/oauth/consent?authorization_id=abc123#decision",
    );
  });

  it.each(["//outside.invalid/path", "/\\outside.invalid/", "https://outside.invalid", "login", "/bad\u0000path"])(
    "rejects an unsafe return target: %s",
    (value) => {
      expect(oauthReturnPath(value)).toBe("/");
    },
  );
});
