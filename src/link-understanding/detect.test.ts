import { describe, expect, it } from "vitest";
import { extractLinksFromMessage } from "./detect.js";

describe("extractLinksFromMessage", () => {
  it("dedupes links and enforces maxLinks", () => {
    const links = extractLinksFromMessage(
      "https://a.example https://a.example https://b.test https://c.test",
      { maxLinks: 2 },
    );
    expect(links).toEqual(["https://a.example", "https://b.test"]);
  });

  it("ignores markdown links whose label contains brackets", () => {
    // The closing "]" inside the label must not break markdown stripping, otherwise
    // the citation URL leaks out as a bare link (with a stray trailing ")").
    const links = extractLinksFromMessage(
      "Check [my notes [v2]](https://internal.example/doc) for details",
    );
    expect(links).toStrictEqual([]);
  });

  it.each([["title line break", '[doc](https://docs.example "line one\nline two")']])(
    "ignores markdown links with a %s",
    (_name, markdownLink) => {
      expect(extractLinksFromMessage(`${markdownLink} https://bare.example`)).toStrictEqual([
        "https://bare.example",
      ]);
    },
  );

  it("does not strip a link with an escaped closing delimiter", () => {
    expect(extractLinksFromMessage('[doc](https://docs.example "t\\")')).toStrictEqual([
      "https://docs.example",
    ]);
  });

  it.each([
    ["a sentence period", "See https://example.com/path.", "https://example.com/path"],
    ["a parenthetical citation", "(see https://example.com/path).", "https://example.com/path"],
    [
      "balanced documentation parentheses",
      "Docs at https://en.wikipedia.org/wiki/URL_(disambiguation).",
      "https://en.wikipedia.org/wiki/URL_(disambiguation)",
    ],
    [
      "an authored comma-separated query",
      "https://example.com/search?q=a,b",
      "https://example.com/search?q=a,b",
    ],
  ])("trims %s from a bare link", (_name, message, expected) => {
    expect(extractLinksFromMessage(message)).toStrictEqual([expected]);
  });

  it("dedupes a punctuated bare link against its authored form", () => {
    expect(
      extractLinksFromMessage("https://example.com/path. and again https://example.com/path."),
    ).toStrictEqual(["https://example.com/path"]);
  });

  it("blocks 127.0.0.1", () => {
    const links = extractLinksFromMessage("http://127.0.0.1/test https://ok.test");
    expect(links).toEqual(["https://ok.test"]);
  });

  it("blocks private IPv4 embedded in an ISATAP URL", () => {
    expect(extractLinksFromMessage("http://[2001:db8:1234::5efe:127.0.0.1]/secret")).toStrictEqual(
      [],
    );
  });
});
