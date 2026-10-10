import { describe, expect, it } from "vitest";
import { trimUrlTrailingPunctuation } from "./url-trailing-punctuation.js";

describe("normalization-core/url-trailing-punctuation", () => {
  it.each([".", "!", "?", ",", ":", ";", "*", "_", "~", ".?!"])(
    "strips trailing GFM punctuation %s",
    (punctuation) => {
      expect(trimUrlTrailingPunctuation(`https://example.com/path${punctuation}`)).toBe(
        "https://example.com/path",
      );
    },
  );

  it("leaves an authored query or fragment untouched", () => {
    expect(trimUrlTrailingPunctuation("https://example.com/search?q=a,b")).toBe(
      "https://example.com/search?q=a,b",
    );
    expect(
      trimUrlTrailingPunctuation("https://example.com/v1.0/URL_(disambiguation)?a=1&b=2#s"),
    ).toBe("https://example.com/v1.0/URL_(disambiguation)?a=1&b=2#s");
  });

  it("keeps balanced parentheses inside the path", () => {
    expect(trimUrlTrailingPunctuation("https://example.com/a_(b)/c")).toBe(
      "https://example.com/a_(b)/c",
    );
  });

  it.each([
    ["https://example.com/path).", "https://example.com/path"],
    ["https://example.com/path))", "https://example.com/path"],
    ["https://example.com/a(b))", "https://example.com/a(b)"],
  ])("drops unmatched closers and following punctuation from %s", (input, expected) => {
    expect(trimUrlTrailingPunctuation(input)).toBe(expected);
  });

  it("keeps an exact authored destination that ends on punctuation", () => {
    const known = new Set(["https://example.com/path."]);
    expect(trimUrlTrailingPunctuation("https://example.com/path.", known)).toBe(
      "https://example.com/path.",
    );
  });

  it("resolves to the bare form when both the authored and punctuated URLs are known", () => {
    const known = new Set(["https://example.com/path", "https://example.com/path."]);
    expect(trimUrlTrailingPunctuation("https://example.com/path.", known)).toBe(
      "https://example.com/path",
    );
  });

  it("stops at an exact authored destination even when a shorter known URL prefixes it", () => {
    const known = new Set(["https://example.com/path", "https://example.com/path."]);
    expect(trimUrlTrailingPunctuation("https://example.com/path.).", known)).toBe(
      "https://example.com/path.",
    );
  });

  it("falls back to the authored destination once sentence punctuation is gone", () => {
    const known = new Set(["https://example.com/path."]);
    expect(trimUrlTrailingPunctuation("https://example.com/path.)", known)).toBe(
      "https://example.com/path.",
    );
    expect(trimUrlTrailingPunctuation("https://example.com/path.)")).toBe(
      "https://example.com/path",
    );
  });

  it("returns an empty string for input that is only punctuation", () => {
    expect(trimUrlTrailingPunctuation("...")).toBe("");
  });
});
