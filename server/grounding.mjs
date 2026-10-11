import {
  need,
  sourceBlocks,
  contentCheck,
  hash,
  definitiveResolution,
} from "./domain.mjs";

export const GROUNDING_VERSION = "evidence-layout-v6";
export const fields = [
  "purpose",
  "scope",
  "responsibilities",
  "prerequisites",
  "steps",
  "exceptions",
  "completion",
  "checklist",
];
// Instructions directed at the drafting system are never policy evidence. A
// prohibition in the office process (e.g. "must not email passwords") is evidence.
export function isEmbeddedCommand(text) {
  const verbs =
    "(?:ignore|override|bypass|disable|reveal|expose|disclose|print|acknowledge|publish|approve)";
  const boundary = "[^,;.!?]*?(?=[,;.!?]|\\b(?:but|and)\\b|$)";
  text = text
    .replace(
      new RegExp(
        "\\b(?:(?:(?:must|shall|should|may|can|will|do|does)\\s+)?(?:not|never)|cannot|can't|don't|doesn't|won't)\\s+" +
          verbs +
          "\\b" +
          boundary,
        "gi",
      ),
      "",
    )
    .replace(
      new RegExp(
        "\\bno\\b[^,;.!?]*?\\b(?:may|must|can|will|shall)\\s+" +
          verbs +
          "\\b" +
          boundary,
        "gi",
      ),
      "",
    );
  return /(?:^|\b)(?:system\s*:|ignore\b.{0,80}(?:instructions|review|rules)|(?:override|bypass|disable)\b.{0,80}(?:instructions|review|approval|security|permissions)|(?:reveal|expose|disclose|print)\b.{0,100}(?:api[\s_-]*key|secret|password|other workspace)|call an external tool|(?:change|set|promote)\b.{0,80}(?:all users|every employee).{0,60}(?:admin|administrator)|output\s*<|(?:approve|publish)\s+(?:and publish\s+)?(?:this\s+)?(?:sop|procedure|document)\s+(?:now|immediately)|acknowledge\s+(?:this|the)\s+(?:procedure|sop)\s+on behalf|mark every task complete)/i.test(
    text,
  );
}

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const sectionLabels =
  "Purpose|Scope|Responsibilities|Prerequisites|Steps?|Exception(?:s)?|Completion(?:\\s+checks)?|Checklist";
const labelPattern = new RegExp(`^(${sectionLabels}):\\s*`, "i");
const headingPattern = new RegExp(`^(${sectionLabels})\\s*:?$`, "i");
const labelField = (label) =>
  ({
    exception: "exceptions",
    exceptions: "exceptions",
    step: "steps",
    "completion checks": "completion",
  })[label.toLowerCase().replace(/\s+/g, " ")] || label.toLowerCase();
const captureText = (text) => text.replace(/^(?:[-*•]\s+|\d{1,3}[.)]\s+)/, "");
function sectionHeading(text) {
  const markdown = /^#{1,6}\s+/.test(text);
  const plain = text
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s+#+\s*$/, "")
    .replace(/:\s*$/, "")
    .replace(/^(\*\*|__|\*|_)(.+)\1$/, "$2")
    .trim();
  const label = plain.match(headingPattern);
  if (label) return { field: labelField(label[1]) };
  // An unrelated heading ends the preceding section without turning its title
  // into an office instruction. Plain headings must occupy a whole label line.
  if (markdown || /^[\p{L}][\p{L}\p{N} &/-]{0,79}:\s*$/u.test(text))
    return { field: null };
  return null;
}
function inferredField(text) {
  // Failure branches belong in escalation; an ordinary business branch (for
  // example, issuing equipment if approved) remains an executable step.
  if (/^(?:if|when|unless|in case)\b/i.test(text)) {
    if (
      /\b(?:does(?:n't| not) work|fails?|failed|failure|unavailable|not available|missing|lost|damaged|rejected|declined|overdue|out of stock|error)\b/i.test(
        text,
      )
    )
      return "exceptions";
    return "steps";
  }
  // A completed state is a check, not another action. Active instructions
  // such as "HR confirms the room is ready" must still remain steps.
  if (
    !actor(text) &&
    /^(?:The\s+)?[^,;.!?]{1,80}?\s+(?:(?:has|have)\s+(?:been\s+)?(?:received|completed|recorded|confirmed|acknowledged|approved|returned|closed|resolved|submitted)|(?:is|are)\s+(?:now\s+)?(?:complete|completed|ready|closed|finished|recorded|confirmed|acknowledged|received))\b/i.test(
      text,
    )
  )
    return "completion";
  return null;
}
function sourceSegments(text) {
  // A lowercase command after a period is not always split by Intl.Segmenter.
  // Explicit boundaries keep the legitimate prefix while excluding the command.
  const separated = captureText(text)
    .replace(
      /;\s*(?=(?:SYSTEM\b\s*:|output\s*<|(?:ignore|reveal|expose|disclose|call an external tool|acknowledge this|mark every task)\b))/gi,
      ".\u2028",
    )
    .replace(
      /,?\s+(?:but|and)\s+(?=(?:output\s*<|(?:reveal|expose|disclose|ignore|override|disable|publish\s+(?:this\s+)?(?:sop|procedure)|acknowledge\s+this|call an external tool)\b))/gi,
      ".\u2028",
    );
  return separated
    .split("\u2028")
    .flatMap((part) =>
      [...segmenter.segment(part)].map((s) => s.segment.trim()),
    )
    .filter(Boolean);
}
function decisionProof(decision, blocks) {
  if (
    !definitiveResolution(decision.answer) ||
    isEmbeddedCommand(decision.answer)
  )
    return { valid: false };
  const originals = blocks
    .filter((b) => decision.sourceIds?.includes(b.id))
    .flatMap((b) =>
      sourceSegments(b.text).map((text) => ({
        sourceId: b.id,
        text: text.replace(labelPattern, ""),
      })),
    )
    .filter((c) => !isEmbeddedCommand(c.text));
  const choice = decision.answer.trim().replace(/[.!]$/, "").toLowerCase();
  const fullRule =
    /\b(?:must|shall|will|can|may|reviews?|approves?|decides?|records?|emails?|sends?|completes?|uses?|applies|activates?|deactivates?|issues?|checks?)\b/i.test(
      decision.answer,
    ) ||
    (/\b(?:is|are)\b/i.test(decision.answer) &&
      /\b(?:deadline|time|approver|owner|approval|limit|amount|currency|date|responsible|required|allowed|permitted|prohibited)\b/i.test(
        decision.answer,
      ));
  const matches = originals.filter((c) =>
    c.text.toLowerCase().includes(choice),
  );
  if (!fullRule && choice.length >= 2 && matches.length === 1)
    return { valid: true, choice: matches[0] };
  const conflict =
    decision.kind === "conflict" ||
    originals.some((a, i) =>
      originals.slice(i + 1).some((b) => incompatible(a, b)),
    );
  if (!conflict) return { valid: true };
  if (!fullRule) return { valid: false };
  const kind = (value) =>
    /^\d{4}-/.test(value)
      ? "date"
      : /^(?:inr|usd|eur|gbp|aud|cad|sgd)\b/i.test(value)
        ? "amount"
        : "duration";
  for (const type of ["date", "amount", "duration"]) {
    const alternatives = originals
      .map((c) =>
        values(c.text)
          .filter((v) => kind(v) === type)
          .join("|"),
      )
      .filter(Boolean);
    if (
      new Set(alternatives).size > 1 &&
      !values(decision.answer).some((v) => kind(v) === type) &&
      !/\b(?:no|without)\s+(?:review\s+)?(?:deadline|time limit|amount limit|approval limit|date restriction)\b/i.test(
        decision.answer,
      )
    )
      return { valid: false };
  }
  return { valid: true };
}
export function evidenceClauses(
  sources,
  {
    clarifications = [],
    rewriteSources = [],
    priorRewriteSources = [],
    supersededSourceIds = [],
  } = {},
) {
  const blocks = sourceBlocks(sources);
  const decisions = new Map(clarifications.map((c) => [c.sourceId, c]));
  const working = new Map(
    [...priorRewriteSources, ...rewriteSources].map((c) => [c.sourceId, c]),
  );
  const clauses = [];
  let inheritedField = null;
  for (const block of blocks) {
    if (supersededSourceIds.includes(block.id)) continue;
    const decision = decisions.get(block.id),
      authored = working.get(block.id);
    const proof = decision && decisionProof(decision, blocks);
    if (decision && !proof.valid) continue;
    if (authored && /^steps\.\d+\.(?:title|responsible)$/.test(authored.path))
      continue;
    let text = decision
      ? decision.answer
      : authored
        ? authored.text
        : block.text;
    let supportSourceIds = [];
    if (proof?.choice) {
      text = proof.choice.text;
      supportSourceIds = [proof.choice.sourceId];
    }
    need(typeof text === "string", "Invalid source evidence.", 502);
    text = captureText(text);
    if (!decision && !authored) {
      const heading = sectionHeading(text);
      if (heading) {
        inheritedField = heading.field;
        continue;
      }
    }
    const label = text.match(labelPattern);
    const field = authored
      ? authored.path?.split(".")[0]
      : label
        ? labelField(label[1])
        : /\b(?:apply|applies) to\b|^(?:This procedure|This process)\b.*\bcovers\b/i.test(
              text,
            )
          ? "scope"
          : null;
    text = text.replace(labelPattern, "");
    let i = 0;
    for (const value of sourceSegments(text)) {
      i++;
      if (!value || isEmbeddedCommand(value)) continue;
      need(
        !/<\/?(?:script|iframe|img|svg|style|a|div|span|p|body)\b/i.test(value),
        "HTML is not permitted in process evidence.",
        502,
      );
      clauses.push({
        id: `${block.id}.C${i}`,
        sourceId: block.id,
        supportSourceIds,
        text: value,
        field: fields.includes(field)
          ? field
          : !decision && !authored && inheritedField
            ? inheritedField === "steps"
              ? inferredField(value) || inheritedField
              : inheritedField
            : inferredField(value),
        order: clauses.length,
        decision: Boolean(decision),
        working: Boolean(authored),
      });
    }
  }
  return clauses;
}

function normalizedRule(text) {
  return text
    .toLowerCase()
    .replace(/\b(?:cannot|can't|don't|doesn't|won't)\b/g, " not ")
    .replace(
      /\b(?:this|same|the|must|shall|will|may|can|do|does|always|never|no)\b/g,
      " ",
    )
    .replace(/\bnot\b/g, " ")
    .replace(
      /\b(reviews|approves|records|sends|activates|deactivates|decides|checks)\b/g,
      (word) => word.slice(0, -1),
    )
    .replace(/\b(?:inr|usd|eur|gbp|aud|cad|sgd)\s+[\d,.]+/g, " #amount ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " #date ")
    .replace(
      /\b\d+(?:\.\d+)?\s+(?:(?:working|business|calendar)\s+)?(?:days?|hours?|minutes?)\b/g,
      " #duration ",
    )
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function values(text) {
  return [
    ...text.matchAll(
      /\b(?:INR|USD|EUR|GBP|AUD|CAD|SGD)\s+[\d,.]+|\b\d{4}-\d{2}-\d{2}\b|\b\d+(?:\.\d+)?\s+(?:(?:working|business|calendar)\s+)?(?:days?|hours?|minutes?)\b/gi,
    ),
  ].map((m) => m[0].toLowerCase());
}
function incompatible(a, b) {
  const av = values(a.text),
    bv = values(b.text);
  const negative = (text) =>
    /\b(?:not|never|no|cannot|can't|don't|doesn't|won't)\b/i.test(text);
  const polarity = negative(a.text) !== negative(b.text);
  if (
    normalizedRule(a.text) === normalizedRule(b.text) &&
    (polarity ||
      (av.length && bv.length && JSON.stringify(av) !== JSON.stringify(bv)))
  )
    return true;
  const exclusive = (text) =>
    text.match(/^Only\s+(.+?)\s+(?:can|may)\s+(.+)$/i);
  const aa = exclusive(a.text),
    bb = exclusive(b.text);
  return Boolean(
    aa &&
    bb &&
    normalizedRule(aa[1]) !== normalizedRule(bb[1]) &&
    normalizedRule(aa[2]) === normalizedRule(bb[2]),
  );
}
// Catch exact same-rule numeric/date and polarity conflicts independently of
// the provider. Different conditions, actors and time units remain distinct.
export function directConflicts(clauses) {
  const groups = [];
  for (let i = 0; i < clauses.length; i++)
    for (let j = i + 1; j < clauses.length; j++) {
      const a = clauses[i],
        b = clauses[j];
      if (a.decision || b.decision) continue;
      if (incompatible(a, b)) groups.push([a.id, b.id]);
    }
  return groups;
}
function unique(items) {
  return [...new Set(items)];
}
function uniqueClauses(items) {
  const map = new Map();
  for (const item of items) {
    const previous = map.get(item.text);
    if (!previous || item.working) map.set(item.text, item);
  }
  return [...map.values()];
}
function actor(text) {
  const match = text.match(
    /^(?:The\s+)?([^.!?;]{1,80}?)\s+(?:emails?|sends?|records?|checks?|approves?|declines?|verifies|prepares?|confirms?|turns?|tests?|places?|contacts?|ensures?|sets?|switches?|activates?|deactivates?|issues?|returns?|collects?|submits?|requests?|signs?|marks?|closes?|informs?|receives?|reviews?|books?|cancels?|removes?|hands?|gives?|offers?|logs?|completes?|creates?|updates?|pays?|schedules?|obtains?|dispatches?|pauses?|acknowledges?|must\s+(?:not\s+)?(?:email|send|record|check|approve|review|activate|issue))\b(?!\s+(?:apply|applies|are|is|was|were|must|shall|will|have|has|contain|show|occur)\b)/i,
  );
  return match &&
    !/^(?:if|for|when|unless|after|before)\b|\b(?:need a way|needs a way|to|knows that|know that|has|have|is|are)\b/i.test(
      match[1],
    )
    ? match[1]
        .trim()
        .replace(
          /\s+(?:(?:never|not|must|shall|should|may|will|can|do|does|cannot|can't|don't|doesn't)\s*)+$/i,
          "",
        )
        .trim()
    : "";
}
function questionEligible(question, clauses, section) {
  const process = clauses.filter((c) => !c.working && !c.decision);
  const referenced = process.filter((c) => question.clauseIds.includes(c.id));
  const explicitUnknown = referenced.some((c) =>
    /\b(?:TBD|TODO|unknown|unspecified|not specified|not yet decided|someone|somebody)\b|_{2,}|\?$/.test(
      c.text,
    ),
  );
  const noActor = referenced.some(
    (c) =>
      /^(?:Approve|Review|Send|Record|Issue|Activate|Confirm|Submit)\b/.test(
        c.text,
      ) || /\b(?:is|must be)\s+(?:approved|reviewed|assigned)\b/.test(c.text),
  );
  if (explicitUnknown || noActor) return true;
  // Multi-step source procedures are conservatively treated as specified.
  // The model cannot add an optional policy question to block their review.
  // Short descriptions without an executable action remain eligible.
  const operational = process.filter((c) => actor(c.text));
  return (
    !section &&
    process.length <= 2 &&
    (operational.length < process.length ||
      process.some((c) =>
        /\b(?:need a way|helps? with|knows? that|we create|last day)\b/i.test(
          c.text,
        ),
      ))
  );
}
function sparseQuestions(clauses, section) {
  const process = clauses.filter((c) => !c.working && !c.decision);
  if (
    section ||
    process.length > 2 ||
    !process.length ||
    !questionEligible({ clauseIds: process.map((c) => c.id) }, clauses, section)
  )
    return null;
  const text = process.map((c) => c.text).join(" "),
    clauseIds = process.map((c) => c.id);
  let prompts;
  if (/\boffice supplies\b/i.test(text))
    prompts = [
      "Who handles office-supply requests?",
      "How should employees submit a request, and which details must they provide?",
    ];
  else if (/\baccount\b/i.test(text))
    prompts = [
      "Who is responsible for creating the employee account?",
      "Which account or system is involved, and what steps create it?",
    ];
  else if (/\bvisitor\b/i.test(text))
    prompts = [
      "Who confirms the visitor's host and appointment?",
      "How is the visitor admitted and checked in?",
    ];
  else if (/\breimburse|\bpayment currency\b/i.test(text))
    prompts = [
      "Which receipts or supporting evidence must employees provide, if any?",
      "Who confirms the reimbursement decision, and which approval or limit rules apply, if any?",
    ];
  else if (/\bdeparting|\blast day|\boffboard/i.test(text))
    prompts = [
      "Who is responsible for the offboarding tasks?",
      "Which equipment-return and access or account steps are required, if any?",
    ];
  else
    prompts = [
      "Who is responsible for this process?",
      "What concrete steps are required, and how is completion recorded?",
    ];
  return prompts.map((question, i) => ({
    question,
    field: i === 0 ? "responsibilities" : "steps",
    clauseIds,
  }));
}
function cleanPlan(plan, clauses) {
  const byId = new Map(clauses.map((c) => [c.id, c]));
  need(
    plan &&
      Array.isArray(plan.placements) &&
      Array.isArray(plan.conflicts) &&
      Array.isArray(plan.questions),
    "The AI returned an incomplete evidence layout.",
    502,
  );
  need(
    plan.placements.length <= 1000 &&
      plan.conflicts.length <= 100 &&
      plan.questions.length <= 12,
    "The AI returned an oversized evidence layout.",
    502,
  );
  const placements = plan.placements.map((p) => {
    need(
      byId.has(p.clauseId) && fields.includes(p.section),
      "The AI referenced invalid evidence.",
      502,
    );
    return { clauseId: p.clauseId, section: p.section };
  });
  const conflicts = plan.conflicts.map((g) => {
    const ids = unique(Array.isArray(g) ? g : g.clauseIds || []);
    need(
      ids.length >= 2 && ids.every((id) => byId.has(id)),
      "The AI returned invalid conflict evidence.",
      502,
    );
    return ids;
  });
  const questions = plan.questions.map((q) => {
    need(
      typeof q.question === "string" &&
        q.question.trim() &&
        q.question.length <= 600 &&
        Array.isArray(q.clauseIds) &&
        q.clauseIds.length &&
        q.clauseIds.every((id) => byId.has(id)) &&
        fields.includes(q.field),
      "The AI returned an invalid clarification question.",
      502,
    );
    need(
      !isEmbeddedCommand(q.question) && !/<[^>]+>/.test(q.question),
      "The AI returned an unsafe clarification question.",
      502,
    );
    return {
      question: q.question.trim(),
      field: q.field,
      clauseIds: unique(q.clauseIds),
    };
  });
  return { placements, conflicts, questions };
}
function semanticContent(content) {
  return { ...content, steps: content.steps.map(({ id, ...s }) => s) };
}
export function materializeLayout(plan, sources, options = {}) {
  const {
    section,
    content,
    clarifications = [],
    rewriteSources = [],
    rewriteSourceIds = [],
  } = options;
  need(!section || fields.includes(section), "Choose a supported section.");
  const clauses = evidenceClauses(sources, options);
  need(
    clauses.length,
    "No usable process facts remain. Add process notes without embedded commands.",
    502,
  );
  const clean = cleanPlan(plan, clauses),
    byId = new Map(clauses.map((c) => [c.id, c]));
  const retired = new Set();
  const resolutions = [];
  for (const decision of clarifications) {
    // Only structured, saved author decisions have this authority. Merely
    // typing an "Author clarification" label in notes cannot retire facts.
    const targets = decision.clauseIds?.length
      ? decision.clauseIds.filter(
          (id) =>
            byId.has(id) && decision.sourceIds?.includes(byId.get(id).sourceId),
        )
      : clauses
          .filter(
            (c) => decision.sourceIds?.includes(c.sourceId) && !c.decision,
          )
          .map((c) => c.id);
    const answer = clauses.filter(
      (c) => c.sourceId === decision.sourceId && c.decision,
    );
    const isConflict =
      decision.kind === "conflict" ||
      (!decision.kind &&
        [...directConflicts(clauses), ...clean.conflicts].some(
          (group) => group.filter((id) => targets.includes(id)).length >= 2,
        ));
    if (answer.length && isConflict && targets.length) {
      targets.forEach((id) => retired.add(id));
      // The author's replacement belongs where the disputed instruction
      // appeared, not at the end of the notes where the answer was recorded.
      const firstOrder = Math.min(...targets.map((id) => byId.get(id).order));
      answer.forEach((clause, index) => {
        clause.order = firstOrder + index / (answer.length + 1);
      });
      resolutions.push({
        gap: decision.gap || decision.id,
        clauseIds: targets,
        sourceIds: unique(targets.map((id) => byId.get(id).sourceId)),
        answer: decision.answer,
      });
    }
  }
  // A provider label alone cannot remove facts. Confirm the pair describes the
  // same rule with incompatible values, polarity or an exclusive approver.
  const verified = clean.conflicts
    .map((ids) =>
      ids.filter((id) =>
        ids.some(
          (other) =>
            other !== id && incompatible(byId.get(id), byId.get(other)),
        ),
      ),
    )
    .filter((ids) => ids.length >= 2);
  const rawConflicts = [...directConflicts(clauses), ...verified];
  const conflicts = [];
  for (const ids of rawConflicts) {
    if (ids.some((id) => retired.has(id))) continue;
    const members = ids.map((id) => byId.get(id));
    if (members.some((c) => c.decision)) continue; // structured author decision prevails over original alternatives
    const key = [...ids].sort().join("|");
    const overlapping = conflicts.filter((g) =>
      g.ids.some((id) => ids.includes(id)),
    );
    if (overlapping.length) {
      const combined = unique([
        ...ids,
        ...overlapping.flatMap((g) => g.ids),
      ]).sort((a, b) => byId.get(a).order - byId.get(b).order);
      for (const group of overlapping)
        conflicts.splice(conflicts.indexOf(group), 1);
      conflicts.push({ key: [...combined].sort().join("|"), ids: combined });
    } else if (!conflicts.some((g) => g.key === key))
      conflicts.push({ key, ids });
  }
  const disputed = new Set(conflicts.flatMap((g) => g.ids));
  // An old authored target may repeat a disputed value; it must not reintroduce
  // that alternative into a section rewrite while the raw source is unresolved.
  const disputedTexts = conflicts.flatMap((g) =>
    g.ids.map((id) => byId.get(id).text),
  );
  for (const c of clauses.filter((c) => c.working))
    if (
      disputedTexts.some(
        (text) => normalizedRule(text) === normalizedRule(c.text),
      )
    )
      disputed.add(c.id);
  const available = clauses
    .filter((c) => !retired.has(c.id) && !disputed.has(c.id))
    .sort((a, b) => a.order - b.order);
  const sections = Object.fromEntries(fields.map((field) => [field, []]));
  for (const c of available) {
    const selected = clean.placements
      .filter((p) => p.clauseId === c.id)
      .map((p) => p.section);
    const terminal = ["exceptions", "completion"].find((field) =>
      selected.includes(field),
    );
    // Source labels and clear sentence meaning prevail over provider layout.
    // Terminal material has one home even if the provider also selects steps.
    const assigned = c.field
      ? [c.field]
      : terminal === "completion" && actor(c.text)
        ? ["steps"]
        : terminal
          ? [terminal]
          : unique([...selected, "steps"]);
    for (const field of assigned) sections[field].push(c);
  }
  const refs = [];
  const cite = (field, items) => {
    if (items.length)
      refs.push({
        field,
        sourceIds: unique(
          items.flatMap((c) => [c.sourceId, ...c.supportSourceIds]),
        ),
      });
  };
  const proposed = {};
  for (const field of fields.filter(
    (f) => !["steps", "checklist"].includes(f),
  )) {
    let items = unique(sections[field]);
    if (!items.length && ["purpose", "scope"].includes(field))
      items = available.slice(0, 1);
    proposed[field] = items.map((c) => c.text).join("\n");
    cite(field, items);
  }
  const stepClauses = uniqueClauses(sections.steps).sort(
    (a, b) => a.order - b.order,
  );
  if (!proposed.responsibilities && stepClauses.some((c) => actor(c.text))) {
    const items = stepClauses.filter((c) => actor(c.text));
    proposed.responsibilities = items.map((c) => c.text).join("\n");
    cite("responsibilities", items);
  }
  proposed.steps = stepClauses.map((c, index) => {
    cite(`steps.${index}`, [c]);
    // Headings are source excerpts rather than another model-authored claim.
    return {
      id: `evidence-${hash(c.id).slice(0, 20)}`,
      title: c.text.length > 100 ? `${c.text.slice(0, 97).trimEnd()}…` : c.text,
      body: c.text,
      responsible: actor(c.text),
    };
  });
  proposed.checklist = unique(sections.checklist).map((c, index) => {
    cite(`checklist.${index}`, [c]);
    return c.text;
  });
  const rejectedDecisions = clarifications.filter(
    (c) => !decisionProof(c, sourceBlocks(sources)).valid,
  );
  const conflictQuestion = (g) =>
    `${rejectedDecisions.some((c) => c.sourceIds?.some((sourceId) => g.ids.some((id) => byId.get(id).sourceId === sourceId))) ? "The previous answer does not state a confirmed rule. Choose one complete alternative or state the full replacement instruction. " : ""}Which instruction applies? Conflicting notes: ${g.ids.map((id) => byId.get(id).text).join(" OR ")}`;
  const gaps = conflicts.map((g) => ({
    id: `conflict-${hash(g.key + conflictQuestion(g)).slice(0, 20)}`,
    kind: "conflict",
    clauseIds: g.ids,
    question: conflictQuestion(g),
    field: section || "steps",
    blocking: true,
    resolution: "",
  }));
  for (const q of sparseQuestions(clauses, section) || clean.questions) {
    if (!questionEligible(q, clauses, section)) continue;
    if (q.clauseIds.some((id) => retired.has(id) || disputed.has(id))) continue;
    if (
      clarifications.some(
        (c) =>
          c.kind === "missing" &&
          c.field === q.field &&
          c.question.trim() === q.question.trim() &&
          decisionProof(c, sourceBlocks(sources)).valid,
      )
    )
      continue;
    gaps.push({
      id: `missing-${hash(q.question + q.clauseIds.join()).slice(0, 20)}`,
      kind: "missing",
      ...q,
      blocking: true,
      resolution: "",
    });
  }
  gaps.forEach((g, index) =>
    cite(
      `gaps.${index}`,
      g.clauseIds.map((id) => byId.get(id)),
    ),
  );
  let result = contentCheck(proposed);
  if (section && content) {
    // Rewrites incorporate the explicitly authored target, retaining facts that
    // were never in the initial capture. Other sections remain byte-for-byte.
    const authored = available.filter((c) =>
      rewriteSourceIds.includes(c.sourceId),
    );
    let selected = uniqueClauses([...sections[section], ...authored]).sort(
      (a, b) => a.order - b.order,
    );
    // A direct section call treats its supplied notes as target evidence. An
    // API call identifies authored target blocks explicitly and retains the
    // broader capture as context for the selected section.
    if (!rewriteSources.length)
      selected = uniqueClauses([
        ...selected,
        ...available.filter(
          (c) =>
            (!c.field || c.field === section) &&
            (section !== "steps" || sections.steps.includes(c)),
        ),
      ]).sort((a, b) => a.order - b.order);
    if (!selected.length && section !== "steps") selected = available;
    const targetRefs = [];
    const targetCite = (field, items) => {
      if (items.length)
        targetRefs.push({
          field,
          sourceIds: unique(
            items.flatMap((c) => [c.sourceId, ...c.supportSourceIds]),
          ),
        });
    };
    let value;
    if (section === "steps")
      value = selected.map((c, i) => {
        const body = rewriteSources.find(
          (s) => s.sourceId === c.sourceId && /^steps\.\d+\.body$/.test(s.path),
        );
        const prefix = body?.path.replace(/\.body$/, "");
        const heading =
          prefix && rewriteSources.find((s) => s.path === `${prefix}.title`);
        const owner =
          prefix &&
          rewriteSources.find((s) => s.path === `${prefix}.responsible`);
        targetRefs.push({
          field: `steps.${i}`,
          sourceIds: unique(
            [
              c.sourceId,
              ...c.supportSourceIds,
              heading?.sourceId,
              owner?.sourceId,
            ].filter(Boolean),
          ),
        });
        return {
          id: `evidence-${hash(c.id).slice(0, 20)}`,
          title: heading?.text || c.text.slice(0, 100),
          body: c.text,
          responsible: owner?.text || actor(c.text),
        };
      });
    else if (section === "checklist")
      value = selected.map((c, i) => {
        targetCite(`checklist.${i}`, [c]);
        return c.text;
      });
    else {
      value = selected.map((c) => c.text).join("\n");
      targetCite(section, selected);
    }
    result = contentCheck({ ...content, [section]: value });
    refs.splice(
      0,
      refs.length,
      ...targetRefs,
      ...refs.filter((r) => r.field.startsWith("gaps.")),
    );
  }
  return {
    content: result,
    gaps,
    sourceRefs: refs,
    grounding: {
      version: GROUNDING_VERSION,
      sourceDigest: hash(sources),
      ...clean,
      resolutions,
    },
  };
}

export function validateGroundedProposal(proposal, sources, options = {}) {
  need(
    proposal.grounding?.version === GROUNDING_VERSION &&
      proposal.grounding.sourceDigest === hash(sources),
    "The proposal does not match its original evidence.",
    409,
  );
  const rebuilt = materializeLayout(proposal.grounding, sources, options);
  need(
    hash(semanticContent(proposal.content)) ===
      hash(semanticContent(rebuilt.content)) &&
      hash(proposal.gaps) === hash(rebuilt.gaps) &&
      hash(proposal.sourceRefs) === hash(rebuilt.sourceRefs) &&
      hash(proposal.grounding.resolutions) ===
        hash(rebuilt.grounding.resolutions),
    "The proposal contains content absent from its grounded evidence.",
    502,
  );
  return proposal;
}
