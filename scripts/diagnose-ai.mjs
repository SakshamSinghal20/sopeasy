import { writeFileSync, mkdirSync } from "node:fs";
import * as ai from "../server/ai.mjs";
import {
  fixtures,
  rewriteFixtures,
  focusedFixtures,
  FIXTURE_VERSION,
  FOCUSED_FIXTURE_VERSION,
} from "./ai-fixtures.mjs";
import { evaluateProposal } from "./evaluate-ai.mjs";
function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
const all = [...fixtures, ...rewriteFixtures, ...focusedFixtures];
if (argument("--model") || argument("--reasoning"))
  throw new Error(
    "Diagnose the configured production generator. Model and reasoning CLI overrides are unsupported by this adapter.",
  );
const fixtureId =
  argument("--fixture") ||
  process.argv
    .slice(2)
    .find((value) => all.some((fixture) => fixture.id === value)) ||
  fixtures[0].id;
const fixture = all.find((item) => item.id === fixtureId);
const fixtureVersion =
  fixture?.kind === "focused" ? FOCUSED_FIXTURE_VERSION : FIXTURE_VERSION;
if (!fixture)
  throw new Error("Choose an existing fixture ID; use evaluate-ai.mjs --list.");
if (!process.argv.includes("--live")) {
  console.log(
    JSON.stringify({
      fixtureVersion,
      fixture: fixture.id,
      kind: fixture.kind,
      section: fixture.section || null,
      sourceFacts: fixture.expected.facts.length,
      providerCalls: 0,
      instruction:
        "Add --live when the revised generation contract is ready. This diagnoses the configured production generator.",
    }),
  );
} else {
  try {
    process.loadEnvFile(".env");
  } catch {}
  const directory =
    ".qa/ai-diagnostics/" +
    new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-") +
    "-" +
    fixture.id;
  mkdirSync(directory, { recursive: true });
  const metadata = [];
  const config = {
    onResponse(data) {
      const entry = {
        finishReason: data.choices?.[0]?.finish_reason,
        usage: data.usage || null,
        contentLength: data.choices?.[0]?.message?.content?.length || 0,
        reasoningLength:
          data.choices?.[0]?.message?.reasoning_content?.length || 0,
        trailingWhitespace: (
          data.choices?.[0]?.message?.content?.match(/\s+$/)?.[0] || ""
        ).length,
        status: data.status || null,
      };
      metadata.push(entry);
      writeFileSync(
        directory + "/response-" + metadata.length + ".json",
        JSON.stringify(data, null, 2),
      );
      console.log("Response metadata: " + JSON.stringify(entry));
    },
    onRejected(data) {
      writeFileSync(
        directory + "/rejected.json",
        JSON.stringify(data, null, 2),
      );
    },
  };
  const started = Date.now();
  try {
    const output = await ai.generateProposal(fixture, config);
    const automatedChecks = evaluateProposal(fixture, output);
    writeFileSync(
      directory + "/evaluation.json",
      JSON.stringify(
        {
          fixtureVersion,
          fixture,
          output,
          metadata,
          elapsedMs: Date.now() - started,
          automatedChecks,
          automatedFidelityPassed: automatedChecks.every(
            (check) => check.passed,
          ),
          humanVerdict: null,
        },
        null,
        2,
      ),
    );
    console.log(
      "Accepted proposal: " +
        automatedChecks.filter((check) => check.passed).length +
        "/" +
        automatedChecks.length +
        " bounded checks. Saved " +
        directory +
        "/evaluation.json; human review is pending.",
    );
    if (automatedChecks.some((check) => !check.passed)) process.exitCode = 1;
  } catch (error) {
    writeFileSync(
      directory + "/evaluation.json",
      JSON.stringify(
        {
          fixtureVersion,
          fixture,
          metadata,
          elapsedMs: Date.now() - started,
          status: "Failed",
          error: error.message,
          humanVerdict: null,
        },
        null,
        2,
      ),
    );
    console.log(
      "Live validation result: " +
        error.message +
        ". Saved " +
        directory +
        "/evaluation.json.",
    );
    process.exitCode = 1;
  }
}
