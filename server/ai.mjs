import { need, contentCheck, sourceBlocks, id } from "./domain.mjs";
export const AI_PROMPT_VERSION = "office-sop-v6";
export const AI_VALIDATOR_VERSION = GROUNDING_VERSION;
const sectionNames = [
  "purpose",
  "scope",
  "responsibilities",
  "prerequisites",
  "exceptions",
  "completion",
];
// The provider cites each item inline. Application code, rather than the model,
// constructs field paths so a citation cannot point at a nonexistent step.
export function unpackProposal(wire, sources) {
  if (!wire?.sections) return wire; // Existing normalized proposal format remains independently validated.
  need(
    wire.sections && typeof wire.sections === "object",
    "The AI returned invalid sections.",
    502,
  );
  need(
    Array.isArray(wire.steps) &&
      Array.isArray(wire.checklist) &&
      Array.isArray(wire.gaps),
    "The AI returned incomplete provenance.",
    502,
  );
  const validIds = new Set(sourceBlocks(sources).map((b) => b.id));
  const sourceRefs = [];
  const citations = (item, field, required = false, record = true) => {
    need(
      item &&
        Array.isArray(item.sourceIds) &&
        item.sourceIds.every((s) => validIds.has(s)),
      "The AI referenced invalid source notes.",
      502,
    );
    need(
      !required || item.sourceIds.length,
      "The AI omitted a source citation.",
      502,
    );
    if (record && item.sourceIds.length)
      sourceRefs.push({ field, sourceIds: [...new Set(item.sourceIds)] });
  };
  const content = {};
  for (const field of sectionNames) {
    const item = wire.sections[field];
    need(
      item && typeof item.text === "string",
      "The AI returned invalid section text.",
      502,
    );
    // Blank sections carry input context on the wire but do not assert a claim.
    citations(
      item,
      field,
      Boolean(item.text.trim()),
      Boolean(item.text.trim()),
    );
    content[field] = item.text;
  }
  content.steps = wire.steps.map((item, index) => {
    citations(item, `steps.${index}`, true);
    return {
      title: item.title,
      body: item.body,
      responsible: item.responsible,
    };
  });
  content.checklist = wire.checklist.map((item, index) => {
    need(
      item && typeof item.text === "string" && item.text.trim(),
      "The AI returned invalid checklist text.",
      502,
    );
    citations(item, `checklist.${index}`, true);
    return item.text;
  });
  const gaps = wire.gaps.map((item, index) => {
    citations(item, `gaps.${index}`);
    return {
      question: item.question,
      field: item.field,
      blocking: item.blocking,
    };
  });
  return { content, gaps, sourceRefs };
}
export function validateProposal(output, sources) {
  need(
    output && typeof output === "object" && !Array.isArray(output),
    "The AI returned an invalid proposal.",
    502,
  );
  const checked = contentCheck(output.content);
  need(
    !/<\/?(?:script|iframe|img|svg|style|a|div|span|p|body)\b/i.test(
      JSON.stringify(checked),
    ),
    "HTML is not permitted in AI proposals.",
    502,
  );
  need(
    Array.isArray(output.gaps) &&
      output.gaps.length <= 100 &&
      Array.isArray(output.sourceRefs) &&
      output.sourceRefs.length <= 500,
    "The AI returned incomplete provenance.",
    502,
  );
  const validIds = new Set(sourceBlocks(sources).map((x) => x.id));
  const refs = output.sourceRefs.map((x) => {
    need(
      x && typeof x === "object",
      "The AI referenced invalid source notes.",
      502,
    );
    const field =
      typeof x.field === "string" ? x.field.replace(/\[(\d+)\]/g, ".$1") : null;
    need(
      typeof field === "string" &&
        /^(purpose|scope|responsibilities|prerequisites|exceptions|completion|steps(?:\.\d+(?:\.(?:body|title|responsible))?)?|checklist(?:\.\d+)?|gaps(?:\.\d+)?)$/.test(
          field,
        ) &&
        Array.isArray(x.sourceIds) &&
        x.sourceIds.length &&
        x.sourceIds.every((s) => validIds.has(s)),
      "The AI referenced invalid source notes.",
      502,
    );
    const [group, index] = field.split(".");
    if (index !== undefined) {
      const collection = group === "gaps" ? output.gaps : checked[group];
      need(
        Array.isArray(collection) && Number(index) < collection.length,
        "The AI referenced a field that does not exist.",
        502,
      );
    }
    return { field, sourceIds: x.sourceIds };
  });
  need(
    refs.length || output.gaps.length,
    "The AI omitted source references.",
    502,
  );
  const gaps = output.gaps.map((x, index) => {
    need(
      x &&
        typeof x.question === "string" &&
        x.question.trim() &&
        typeof x.field === "string" &&
        x.field.trim() &&
        typeof x.blocking === "boolean",
      "The AI returned an invalid question.",
      502,
    );
    if (x.sourceIds !== undefined) {
      need(
        Array.isArray(x.sourceIds) && x.sourceIds.every((s) => validIds.has(s)),
        "The AI referenced invalid question sources.",
        502,
      );
      if (x.sourceIds.length)
        refs.push({
          field: `gaps.${index}`,
          sourceIds: [...new Set(x.sourceIds)],
        });
    }
    return {
      id: id(),
      question: x.question.slice(0, 2000),
      field: x.field.slice(0, 160),
      blocking: x.blocking !== false,
      resolution: "",
    };
  });
  return { content: checked, gaps, sourceRefs: refs };
}
function deadlineFacts(text) {
  const format = (value, unit) =>
    `${Number(value)} ${unit?.toLowerCase() || ""} days`.replace(/\s+/g, " ");
  const facts = [
    ...text.matchAll(
      /\b(\d+(?:\.\d+)?)\s+(?:(working|business|calendar)\s+)?days?\b/gi,
    ),
  ].map((m) => format(m[1], m[2]));
  for (const match of text.matchAll(
    /\b(\d+(?:\.\d+)?)\s*(?:or|\/)\s*(\d+(?:\.\d+)?)\s+(?:(working|business|calendar)\s+)?days?\b/gi,
  )) {
    facts.push(format(match[1], match[3]), format(match[2], match[3]));
  }
  return facts;
}
function amountFacts(text) {
  return [
    ...text.matchAll(/\b(INR|USD|EUR|GBP|AUD|CAD|SGD)\s+([\d,]+(?:\.\d+)?)/gi),
  ].map((m) => `${m[1].toUpperCase()} ${Number(m[2].replaceAll(",", ""))}`);
}
// A deliberately narrow factual guard. It catches dropped explicit numbers and
// selected disputed deadlines; it does not prove semantic fidelity or replace review.
export function guardSourceFacts(proposal, sources, { section = false } = {}) {
  const contentText = JSON.stringify(proposal.content);
  const unsafeInstruction =
    /(?:reveal|expose|disclose|print)\b.{0,100}(?:api[\s_-]*keys?|secrets?|passwords?|other\s+workspace\s+documents)|(?:ignore|override|bypass|disable)\b.{0,80}(?:instructions?|review|approvals?|permissions?|security)|(?:change|set|promote)\b.{0,100}(?:all users|every employee|users).{0,50}(?:administrators?|admins?)|acknowledge\b.{0,100}on behalf|call an external tool/i;
  const hostileSourceIds = new Set(
    sourceBlocks(sources)
      .filter((b) => unsafeInstruction.test(b.text))
      .map((b) => b.id),
  );
  const citesHostileInstruction = proposal.sourceRefs.some(
    (ref) =>
      !ref.field.startsWith("gaps.") &&
      ref.sourceIds.some((source) => hostileSourceIds.has(source)),
  );
  need(
    !unsafeInstruction.test(contentText) && !citesHostileInstruction,
    "The AI copied an unsafe instruction from source notes. Your saved content is unchanged; remove embedded commands or draft manually.",
    502,
  );
  const sourceMap = new Map(
    sourceBlocks(sources).map((block) => [block.id, block.text]),
  );
  const replacement = /instead of|replaces? (?:the )?(?:department )?manager/i;
  for (const ref of proposal.sourceRefs) {
    if (ref.field.startsWith("gaps.")) continue;
    const [field, index, part] = ref.field.split(".");
    const claim =
      index === undefined
        ? proposal.content[field]
        : part
          ? proposal.content[field]?.[Number(index)]?.[part]
          : proposal.content[field]?.[Number(index)];
    if (replacement.test(JSON.stringify(claim))) {
      need(
        ref.sourceIds.some((source) =>
          replacement.test(sourceMap.get(source) || ""),
        ),
        "The AI added a replacement rule absent from its cited notes. Your saved content is unchanged; draft manually or request another proposal.",
        502,
      );
    }
  }
  const questions = proposal.gaps.map((g) => g.question).join(" ");
  const sourceDeadlines = new Set(deadlineFacts(sources));
  const contentDeadlines = new Set(deadlineFacts(contentText));
  const questionDeadlines = new Set(deadlineFacts(questions));
  if (!section) {
    need(
      [...sourceDeadlines].every(
        (f) => contentDeadlines.has(f) || questionDeadlines.has(f),
      ),
      "The AI omitted an explicit source deadline. Your saved content is unchanged; draft manually or request another proposal.",
      502,
    );
    const outputAmounts = new Set(amountFacts(contentText + " " + questions));
    need(
      amountFacts(sources).every((f) => outputAmounts.has(f)),
      "The AI omitted an explicit source amount. Your saved content is unchanged; draft manually or request another proposal.",
      502,
    );
  }
  for (const gap of proposal.gaps) {
    if (
      !/\bor\b|conflict|contradict|which.*deadline|supersede/i.test(
        gap.question,
      )
    )
      continue;
    const disputed = [...new Set(deadlineFacts(gap.question))].filter((f) =>
      sourceDeadlines.has(f),
    );
    if (disputed.length >= 2) {
      need(
        !disputed.some((f) => contentDeadlines.has(f)),
        "The AI repeated a disputed deadline in the proposed instructions. Your saved content is unchanged; resolve the source conflict and draft manually.",
        502,
      );
    }
  }
  return proposal;
}

export { generateGroundedProposal as generateProposal } from "./generate.mjs";
import { GROUNDING_VERSION, validateGroundedProposal } from "./grounding.mjs";
export function validateGeneratedProposal(proposal, sources, options = {}) {
  need(
    proposal && typeof proposal === "object",
    "The AI returned an invalid proposal.",
    502,
  );
  need(
    !(proposal.promptVersion || proposal.validatorVersion) ||
      proposal.grounding?.version === AI_VALIDATOR_VERSION,
    "This proposal uses an outdated AI format. Generate a new proposal.",
    409,
  );
  return proposal.grounding
    ? validateGroundedProposal(proposal, sources, options)
    : guardSourceFacts(validateProposal(proposal, sources), sources, {
        section: Boolean(options.section),
      });
}
