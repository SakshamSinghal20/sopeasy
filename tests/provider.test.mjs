import test from "node:test";
import assert from "node:assert/strict";
import { aiProvider } from "../server/provider.mjs";
import { generateGroundedProposal } from "../server/generate.mjs";
import { validateGeneratedProposal } from "../server/ai.mjs";

const input = {
  title: "Room setup",
  sources:
    "Purpose: Prepare a meeting room.\nSteps:\nThe coordinator checks the booking.\nExceptions:\nIf the display fails, contact IT.\nCompletion checks:\nThe host confirms the room is ready.",
};
const response = (layout, finishReason = "STOP") => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [
      {
        finishReason,
        content: {
          parts: [
            { thought: true, text: "Private reasoning" },
            { text: JSON.stringify(layout) },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 80 },
  }),
});
const layoutFor = (body) => ({
  placements: JSON.parse(body.contents[0].parts[0].text).evidence.map(
    (clause) => ({ clauseId: clause.id, section: clause.field || "steps" }),
  ),
  conflicts: [],
  questions: [],
});

test("provider selection uses only its own key and rejects unknown providers", () => {
  assert.equal(
    aiProvider({}, { SARVAM_API_KEY: "sarvam-test" }).name,
    "Sarvam",
  );
  const selected = aiProvider(
    {},
    {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "gemini-test",
      SARVAM_API_KEY: "sarvam-test",
    },
  );
  assert.equal(selected.key, "gemini-test");
  assert.equal(selected.model, "gemini-3.8-flash");
  assert.equal(
    aiProvider({}, { AI_PROVIDER: "gemini", SARVAM_API_KEY: "sarvam-test" })
      .key,
    undefined,
  );
  assert.throws(
    () => aiProvider({}, { AI_PROVIDER: "unknown" }),
    /AI_PROVIDER/,
  );
});

test("Gemini sends a server-side structured evidence request and preserves grounded sections", async () => {
  const output = await generateGroundedProposal(input, {
    provider: "gemini",
    key: "gemini-test",
    fetch: async (url, options) => {
      assert.equal(
        url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      );
      assert.equal(options.headers["x-goog-api-key"], "gemini-test");
      assert.equal(options.headers["api-subscription-key"], undefined);
      const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.ok(body.generationConfig.responseJsonSchema.properties.placements);
      assert.equal(
        body.generationConfig.responseJsonSchema.properties.placements.maxItems,
        undefined,
      );
      assert.equal(
        body.generationConfig.responseJsonSchema.properties.questions.items
          .properties.question.maxLength,
        undefined,
      );
      assert.ok(!options.body.includes("gemini-test"));
      return response(layoutFor(body));
    },
  });
  assert.equal(output.provider, "Gemini");
  assert.equal(output.content.steps.length, 1);
  assert.match(output.content.exceptions, /display fails/);
  assert.match(output.content.completion, /host confirms/);
  assert.ok(!JSON.stringify(output).includes("gemini-test"));
  assert.ok(!JSON.stringify(output).includes("Private reasoning"));
  assert.doesNotThrow(() =>
    validateGeneratedProposal(output, input.sources, input),
  );
});

test("Gemini retries transient failures and rejects truncated output without materializing it", async () => {
  let attempts = 0;
  const output = await generateGroundedProposal(input, {
    provider: "gemini",
    key: "test",
    fetch: async (url, options) => {
      if (++attempts === 1) return { ok: false, status: 503 };
      return response(layoutFor(JSON.parse(options.body)));
    },
  });
  assert.equal(output.attempts, 2);
  await assert.rejects(
    generateGroundedProposal(input, {
      provider: "gemini",
      key: "test",
      fetch: async (url, options) =>
        response(layoutFor(JSON.parse(options.body)), "MAX_TOKENS"),
    }),
    /output limit/,
  );
});

test("Gemini rejects endpoint injection and handles rejected credentials", async () => {
  await assert.rejects(
    generateGroundedProposal(input, {
      provider: "gemini",
      key: "test",
      model: "gemini-3.8-flash/other",
      fetch: () => {
        throw new Error("must not call");
      },
    }),
    /supported Gemini/,
  );
  await assert.rejects(
    generateGroundedProposal(input, {
      provider: "gemini",
      key: "test",
      fetch: async () => ({ ok: false, status: 401 }),
    }),
    /provider could not complete/,
  );
});
