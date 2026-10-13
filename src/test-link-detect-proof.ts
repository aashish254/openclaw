// Real behavior proof for PR #170852: link-detect punctuation handling
// Run with: bun run --no-cache src/test-link-detect-proof.ts
// Purpose: Prove extractLinksFromMessage preserves queries/fragments and demonstrates prose punctuation handling

import { extractLinksFromMessage } from "./link-understanding/detect.js";

console.log("=== Link Detection Behavior Proof ===\n");

const tests = [
  // Query strings - MUST preserve exactly (THE KEY FIX)
  {
    input: "Query ids=1,2: https://example.com/?ids=1,2",
    expected: ["https://example.com/?ids=1,2"],
    description: "Comma in query preserved (CRITICAL FIX VERIFICATION)",
  },
  {
    input: "Search foo)bar: https://example.com/search?q=foo)bar",
    expected: ["https://example.com/search?q=foo)bar"],
    description: "Closing paren in query preserved",
  },
  {
    input: "Fragment: https://example.com/page#section,",
    expected: ["https://example.com/page#section,"],
    description: "Fragment comma preserved",
  },

  // Prose punctuation after URLs
  {
    input: "See https://example.com/path.",
    expected: ["https://example.com/path."],
    description: "Trailing period preserved (queries NOT trimmed)",
  },
  {
    input: "Check https://example.com/path! for details",
    expected: ["https://example.com/path!"],
    description: "Exclamation preserved",
  },

  // Multiple links
  {
    input: "See https://a.com. And https://b.com!",
    expected: ["https://a.com.", "https://b.com!"],
    description: "Multiple prose endings preserved",
  },
];

let passCount = 0;
let failCount = 0;

for (const test of tests) {
  const results = extractLinksFromMessage(test.input);
  const match = JSON.stringify(results) === JSON.stringify(test.expected);

  if (match) {
    passCount++;
    console.log(`✅ ${test.description}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Extracted: ${JSON.stringify(results)}\n`);
  } else {
    failCount++;
    console.log(`❌ ${test.description}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: ${JSON.stringify(test.expected)}`);
    console.log(`   Got: ${JSON.stringify(results)}\n`);
  }
}

console.log("=== Summary ===");
console.log(`Passed: ${passCount}/${tests.length}`);
console.log(`Failed: ${failCount}/${tests.length}`);
console.log("");

if (failCount === 0) {
  console.log("SUCCESS: All behaviors match expected output.");
  console.log("- Query strings/fragments preserved exactly as written ✓");
  console.log("- Trailing punctuation NOT removed from fetch destinations ✓");
  console.log("\nThis proves the fix resolves P1: preserve authored query and fragment bytes.");
} else {
  console.log("FAILURE: Some tests failed.");
  process.exit(1);
}
