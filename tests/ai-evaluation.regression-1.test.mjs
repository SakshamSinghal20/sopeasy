import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProposal } from "../scripts/evaluate-ai.mjs";
import { focusedFixtures } from "../scripts/ai-fixtures.mjs";
import { materializeLayout } from "../server/grounding.mjs";

// Regression: ISSUE-001 — the evaluator required completion evidence to repeat as a step.
// Found by /qa on 2026-10-12.
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-12.md
test("AI evaluation accepts separate completion evidence and rejects a duplicated completion step", () => {
  const fixture = focusedFixtures.find(
    (item) => item.id === "boundary-list-markers",
  );
  const output = materializeLayout(
    { placements: [], conflicts: [], questions: [] },
    fixture.sources,
    fixture,
  );
  assert.deepEqual(
    evaluateProposal(fixture, output).filter((check) => !check.passed),
    [],
  );
  const duplicate = structuredClone(output);
  duplicate.content.steps.push({
    title: "Record completion",
    body: output.content.completion,
    responsible: "IT",
  });
  assert(
    evaluateProposal(fixture, duplicate).some(
      (check) => check.group === "placement" && !check.passed,
    ),
  );
});
