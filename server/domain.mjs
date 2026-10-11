import { randomUUID, createHash } from "node:crypto";
import { definitiveResolution } from "../shared/answers.mjs";
export { definitiveResolution };

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class Problem extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const need = (test, message, status = 400) => {
  if (!test) throw new Problem(message, status);
};
export const admin = (member) => ["Owner", "Admin"].includes(member.role);
export const author = (member) =>
  ["Owner", "Admin", "Author"].includes(member.role);
export const canEdit = (member, doc) =>
  admin(member) || (author(member) && doc.owner === member.id);
export const canDraft = (member, doc) =>
  canEdit(member, doc) || doc.candidate?.reviewer === member.id;
export const templates = [
  {
    id: "onboarding",
    name: "Employee onboarding",
    category: "People & culture",
    description: "Give every new joiner a clear first week.",
    icon: "people",
    color: "sage",
  },
  {
    id: "equipment",
    name: "Equipment request",
    category: "Operations",
    description: "From a request to the tools people need.",
    icon: "laptop",
    color: "blue",
  },
  {
    id: "leave",
    name: "Leave request",
    category: "People & culture",
    description: "Make time-off requests straightforward.",
    icon: "calendar",
    color: "clay",
  },
  {
    id: "general",
    name: "Office procedure",
    category: "Operations",
    description: "Document the way your team gets work done.",
    icon: "file",
    color: "yellow",
  },
];
export function emptyContent() {
  return {
    purpose: "",
    scope: "",
    responsibilities: "",
    prerequisites: "",
    steps: [{ id: id(), title: "", body: "", responsible: "" }],
    exceptions: "",
    completion: "",
    checklist: [],
  };
}
export function contentCheck(content, ready = false) {
  need(content && typeof content === "object", "A document is required.");
  const fields = [
    "purpose",
    "scope",
    "responsibilities",
    "prerequisites",
    "exceptions",
    "completion",
  ];
  const result = Object.fromEntries(
    fields.map((key) => {
      need(typeof (content[key] ?? "") === "string", `Invalid ${key}.`);
      return [key, (content[key] || "").slice(0, 60000)];
    }),
  );
  need(
    Array.isArray(content.steps) && content.steps.length <= 100,
    "Use up to 100 procedure steps.",
  );
  result.steps = content.steps.map((step) => {
    need(
      step && typeof step.title === "string" && typeof step.body === "string",
      "Each step needs a title and instructions.",
    );
    return {
      id: typeof step.id === "string" ? step.id : id(),
      title: step.title.slice(0, 300),
      body: step.body.slice(0, 60000),
      responsible:
        typeof step.responsible === "string"
          ? step.responsible.slice(0, 160)
          : "",
    };
  });
  result.checklist = Array.isArray(content.checklist)
    ? content.checklist.filter((x) => typeof x === "string").slice(0, 100)
    : [];
  need(
    JSON.stringify(result).length <= 60000,
    "Document content exceeds 60,000 characters.",
  );
  if (ready) {
    need(result.purpose.trim(), "Add the purpose before review.");
    need(result.scope.trim(), "Add the scope before review.");
    need(
      result.steps.some((x) => x.title.trim() && x.body.trim()),
      "Add at least one complete step.",
    );
    need(
      !/\[(?:TODO|TBD|insert|placeholder)[^\]]*\]/i.test(
        JSON.stringify(result),
      ),
      "Resolve document placeholders before review.",
    );
  }
  return result;
}
export function sourceBlocks(text) {
  return text
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `S${i + 1}`, text }));
}
export function gapSourceEvidence(candidate, gap, index) {
  return structuredClone(
    gap.sourceEvidence ||
      gap.resolutionEvidence ||
      (candidate.sourceRefs || [])
        .filter((ref) => ref.field === `gaps.${index}`)
        .flatMap((ref) => ref.sourceIds)
        .map((sourceId) =>
          sourceBlocks(candidate.sources).find(
            (block) => block.id === sourceId,
          ),
        )
        .filter(Boolean),
  );
}
export function rebindClauseIds(clauseIds, evidence, sources) {
  const blocks = sourceBlocks(sources);
  const sourceMap = new Map(
    evidence
      .map((block) => [
        block.id,
        blocks.find((current) => current.text === block.text)?.id,
      ])
      .filter(([, sourceId]) => sourceId),
  );
  return (clauseIds || [])
    .map((clauseId) => {
      const prefix = clauseId.match(/^(S\d+)(?=[:._-]?C)/)?.[1];
      return prefix && sourceMap.has(prefix)
        ? clauseId.replace(prefix, sourceMap.get(prefix))
        : null;
    })
    .filter(Boolean);
}
export function generationSourceSnapshot(
  candidate,
  section = null,
  proposals = [],
) {
  let sources = candidate.sources;
  const clarifications = [];
  const rewriteSources = [];
  const priorRewriteSources = [];
  const supersededSourceIds = [];
  const append = (text) => {
    const existing = sourceBlocks(sources).find((block) => block.text === text);
    if (existing) return existing.id;
    sources += `${sources.endsWith("\n") ? "" : "\n"}${text}`;
    return sourceBlocks(sources).at(-1).id;
  };
  for (const [index, gap] of candidate.gaps.entries()) {
    for (const previous of gap.acceptedClarifications || [])
      if (previous.answer !== gap.resolution?.trim()) {
        const block = sourceBlocks(sources).find(
          (block) => block.text === previous.sourceText,
        );
        if (block) supersededSourceIds.push(block.id);
      }
    if (!gap.resolution?.trim()) continue;
    const evidence =
      gap.resolutionEvidence ||
      gap.sourceEvidence ||
      (candidate.sourceRefs || [])
        .filter((ref) => ref.field === `gaps.${index}`)
        .flatMap((ref) => ref.sourceIds)
        .map((sourceId) =>
          sourceBlocks(candidate.sources).find(
            (block) => block.id === sourceId,
          ),
        )
        .filter(Boolean);
    const sourceMap = new Map(
      evidence
        .map((item) => [
          item.id,
          sourceBlocks(sources).find((block) => block.text === item.text)?.id,
        ])
        .filter(([, value]) => value),
    );
    const sourceIds = [...new Set(sourceMap.values())];
    const clauseIds = (gap.clauseIds || []).map((clauseId) =>
      clauseId.replace(
        /^(S\d+)(?=[:._-]?C)/,
        (prefix) => sourceMap.get(prefix) || prefix,
      ),
    );
    const answer = gap.resolution.trim();
    const text = `Author clarification [${gap.id}] for ${gap.field}: ${gap.question.replace(/\s+/g, " ").trim()} Answer: ${answer.replace(/\s+/g, " ")}`;
    const sourceId = append(text);
    clarifications.push({
      gap: gap.id,
      field: gap.field,
      question: gap.question,
      answer,
      kind: gap.kind || null,
      clauseIds,
      sourceIds,
      actor: gap.resolvedBy || null,
      time: gap.resolvedAt || null,
      sourceId,
    });
  }
  const working = (path, value) => {
    if (!value?.trim()) return;
    const text = value.trim();
    const sourceId = append(
      `Author working ${section} ${path}: ${text.replace(/\s+/g, " ")}`,
    );
    rewriteSources.push({ path, text, sourceId });
  };
  if (section === "steps")
    candidate.content.steps.forEach((step, index) => {
      for (const field of ["title", "body", "responsible"])
        working(`steps.${index}.${field}`, step[field]);
    });
  else if (section === "checklist")
    candidate.content.checklist.forEach((item, index) =>
      working(`checklist.${index}`, item),
    );
  else if (section) working(section, candidate.content[section]);
  const currentBlocks = sourceBlocks(sources);
  for (const proposal of proposals.filter(
    (proposal) =>
      proposal.status === "Accepted" && proposal.request?.sourceSnapshot,
  )) {
    const original = sourceBlocks(proposal.request.sourceSnapshot);
    for (const item of [
      ...(proposal.request.priorRewriteSources || []),
      ...(proposal.request.rewriteSources || []),
    ]) {
      const old = original.find((block) => block.id === item.sourceId);
      const current =
        old && currentBlocks.find((block) => block.text === old.text);
      if (
        current &&
        !priorRewriteSources.some(
          (source) =>
            source.sourceId === current.id && source.path === item.path,
        )
      )
        priorRewriteSources.push({ ...item, sourceId: current.id });
    }
  }
  need(
    sources.length <= 40000,
    "Source notes and author clarifications exceed 40,000 characters. Shorten notes before generation.",
  );
  return {
    sources,
    clarifications,
    rewriteSources,
    priorRewriteSources,
    rewriteSourceIds: rewriteSources.map((item) => item.sourceId),
    supersededSourceIds: [...new Set(supersededSourceIds)],
  };
}
export function event(state, member, action, target, extra = {}) {
  const e = {
    id: id(),
    actor: member.name,
    actorId: member.id,
    action,
    outcome: "success",
    target,
    time: now(),
    ...extra,
  };
  state.audit.unshift(e);
  return e;
}
export function notify(
  state,
  members,
  recipients,
  title,
  message,
  target,
  key,
) {
  for (const memberId of new Set(recipients)) {
    if (!members.some((x) => x.id === memberId && x.active)) continue;
    if (state.notifications.some((x) => x.key === key && x.member === memberId))
      continue;
    state.notifications.unshift({
      id: id(),
      member: memberId,
      title,
      message,
      target,
      key,
      time: now(),
      read: false,
    });
  }
}
export function findDoc(state, docId) {
  const doc = state.documents.find((x) => x.id === docId);
  need(doc, "Procedure not found.", 404);
  return doc;
}
export function current(doc) {
  return doc.versions.find((x) => x.number === doc.current) || null;
}
export function docView(doc, member) {
  need(
    canDraft(member, doc) || doc.current,
    "You do not have access to this procedure.",
    403,
  );
  const permitted = canDraft(member, doc);
  const versions = canEdit(member, doc)
    ? doc.versions
    : doc.archived
      ? []
      : doc.versions
          .filter((x) => x.number === doc.current)
          .map(({ sources, gaps, sourceRefs, ...v }) => v);
  return {
    ...doc,
    title: permitted ? doc.title : current(doc)?.title || doc.title,
    candidate: permitted ? doc.candidate : null,
    checkpoints: canEdit(member, doc) ? doc.checkpoints : [],
    versions,
    approvals: permitted ? doc.approvals : [],
    proposals: permitted ? doc.proposals : [],
  };
}
export function createDoc(state, member, input) {
  need(author(member), "Your role cannot create procedures.", 403);
  const title = String(input.title || "").trim();
  need(title && title.length <= 160, "Add a title of up to 160 characters.");
  need(
    String(input.sources || "").length <= 40000,
    "Source notes exceed 40,000 characters.",
  );
  need(
    String(input.department || "").trim().length <= 80,
    "Use a department label of up to 80 characters.",
  );
  const doc = {
    id: id(),
    title,
    category:
      input.category ||
      templates.find((x) => x.id === input.template)?.category ||
      "Operations",
    department: String(input.department || "")
      .trim()
      .slice(0, 80),
    template: input.template || "general",
    owner: member.id,
    archived: false,
    created: now(),
    updated: now(),
    current: 0,
    versions: [],
    approvals: [],
    proposals: [],
    checkpoints: [],
    reviewDue: null,
    candidate: {
      id: id(),
      revision: 1,
      status: "Draft",
      content: emptyContent(),
      sources: String(input.sources || ""),
      gaps: [],
      sourceRefs: [],
      editors: [member.id],
      reviewer: null,
      submission: null,
      feedback: "",
      approval: null,
    },
  };
  state.documents.unshift(doc);
  event(state, member, "Created procedure", doc.id);
  return doc;
}
export function saveDoc(state, member, doc, input) {
  need(canEdit(member, doc), "You cannot edit this procedure.", 403);
  need(doc.candidate, "Start a revision first.");
  const c = doc.candidate;
  need(
    c.status !== "In review",
    "Withdraw this submission before editing.",
    409,
  );
  need(
    c.revision === input.revision,
    "A newer revision was saved. Copy your text, then reload the latest revision.",
    409,
  );
  const content = contentCheck(input.content);
  const sources = String(input.sources ?? c.sources);
  need(sources.length <= 40000, "Source notes exceed 40,000 characters.");
  const oldSourceRefs = structuredClone(c.sourceRefs || []);
  const oldSourceBlocks = sourceBlocks(c.sources);
  c.gaps = c.gaps.map((gap, index) => ({
    ...gap,
    sourceEvidence: gapSourceEvidence(c, gap, index),
  }));
  const changed = hash(content) !== hash(c.content) || sources !== c.sources;
  if (changed) {
    c.editors = [...new Set([...c.editors, member.id])];
    c.approval = null;
    if (c.status === "Approved") c.status = "Draft";
    if (sources !== c.sources) {
      c.sourceRefs = [];
    } else {
      c.sourceRefs = c.sourceRefs.filter((ref) => {
        const group = ref.field.split(".")[0];
        return (
          group === "gaps" || hash(content[group]) === hash(c.content[group])
        );
      });
    }
  }
  c.content = content;
  c.sources = sources;
  c.revision++;
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    need(
      title && title.length <= 160,
      "A title of up to 160 characters is required.",
    );
    if (title !== doc.title) {
      doc.title = title;
      c.approval = null;
      c.editors = [...new Set([...c.editors, member.id])];
      if (c.status === "Approved") c.status = "Draft";
    }
  }
  if (input.category) doc.category = String(input.category).slice(0, 80);
  if (input.department !== undefined) {
    const department = String(input.department || "").trim();
    need(
      department.length <= 80,
      "Use a department label of up to 80 characters.",
    );
    doc.department = department;
  }
  if (input.gaps) {
    need(Array.isArray(input.gaps), "Invalid gap decisions.");
    const next = c.gaps.map((g, index) => {
      const decision = input.gaps.find((x) => x.id === g.id);
      if (!decision) return g;
      need(
        typeof decision.resolution === "string" &&
          decision.resolution.length <= 2000,
        "Use a gap answer of up to 2,000 characters.",
      );
      if (decision.resolution === (g.resolution || "")) return g;
      const evidence =
        g.resolutionEvidence ||
        g.sourceEvidence ||
        oldSourceRefs
          .filter((ref) => ref.field === `gaps.${index}`)
          .flatMap((ref) => ref.sourceIds)
          .map((sourceId) =>
            oldSourceBlocks.find((block) => block.id === sourceId),
          )
          .filter(Boolean);
      return {
        ...g,
        resolution: decision.resolution,
        resolvedBy: member.id,
        resolvedAt: now(),
        resolutionEvidence: structuredClone(evidence),
      };
    });
    if (hash(next) !== hash(c.gaps)) {
      c.approval = null;
      c.editors = [...new Set([...c.editors, member.id])];
      if (c.status === "Approved") c.status = "Draft";
    }
    c.gaps = next;
  }
  if (input.checkpoint) {
    doc.checkpoints.unshift({
      id: id(),
      revision: c.revision,
      content: structuredClone(c.content),
      sources: c.sources,
      gaps: structuredClone(c.gaps),
      sourceRefs: structuredClone(c.sourceRefs),
      time: now(),
      actor: member.name,
    });
    doc.checkpoints = doc.checkpoints.slice(0, 100);
    event(state, member, "Saved checkpoint", doc.id, { revision: c.revision });
  }
  doc.updated = now();
  return doc;
}
export function submitDoc(state, member, members, doc, input) {
  need(canEdit(member, doc), "You cannot submit this procedure.", 403);
  const c = doc.candidate;
  need(
    c && ["Draft", "Changes requested"].includes(c.status),
    "This candidate is not editable.",
    409,
  );
  need(
    c.revision === input.revision,
    "Save and refresh the latest revision before submitting.",
    409,
  );
  contentCheck(c.content, true);
  need(
    members.some((m) => m.id === doc.owner && m.active && author(m)),
    "Assign an active process owner before review.",
  );
  need(
    !c.gaps.some((g) => g.blocking && !definitiveResolution(g.resolution)),
    "Resolve the open questions before review.",
  );
  const reviewer = members.find(
    (x) => x.id === input.reviewer && x.active && author(x),
  );
  need(reviewer, "Select an active reviewer.");
  need(
    !c.editors.includes(reviewer.id),
    "Choose a reviewer who has not edited this candidate.",
  );
  c.reviewer = reviewer.id;
  c.status = "In review";
  c.submission = {
    id: id(),
    revision: c.revision,
    content: structuredClone(c.content),
    title: doc.title,
    sources: c.sources,
    gaps: structuredClone(c.gaps),
    hash: hash({ title: doc.title, content: c.content }),
    time: now(),
  };
  c.approval = null;
  event(state, member, "Submitted for review", doc.id, {
    revision: c.revision,
  });
  notify(
    state,
    members,
    [reviewer.id],
    "A procedure needs your review",
    doc.title,
    doc.id,
    c.submission.id,
  );
  return doc;
}
export function reviewDoc(state, member, members, doc, input) {
  const c = doc.candidate;
  need(
    c?.status === "In review" && c.reviewer === member.id && author(member),
    "This review is not assigned to you.",
    403,
  );
  need(
    !c.editors.includes(member.id),
    "A content editor cannot approve their candidate.",
    403,
  );
  need(
    c.submission?.id === input.submission,
    "This submission has been replaced.",
    409,
  );
  if (input.decision === "approve") {
    need(
      c.submission.hash === hash({ title: doc.title, content: c.content }),
      "The document changed after submission.",
      409,
    );
    c.status = "Approved";
    c.approval = {
      id: id(),
      submission: c.submission.id,
      hash: c.submission.hash,
      reviewer: member.id,
      name: member.name,
      time: now(),
      note: String(input.note || "").slice(0, 2000),
    };
    doc.approvals.push(structuredClone(c.approval));
    event(state, member, "Approved revision", doc.id, { revision: c.revision });
  } else {
    need(String(input.note || "").trim(), "Explain the changes you need.");
    c.status = "Changes requested";
    c.feedback = String(input.note).slice(0, 2000);
    event(state, member, "Requested changes", doc.id, { revision: c.revision });
  }
  notify(
    state,
    members,
    [doc.owner],
    c.status === "Approved"
      ? "Your procedure is approved"
      : "Changes requested",
    doc.title,
    doc.id,
    `${c.submission.id}-${c.status}`,
  );
  return doc;
}
export function localDeadline(date, timezone) {
  need(/^\d{4}-\d{2}-\d{2}$/.test(date), "Choose a valid deadline date.");
  let utc = Date.parse(`${date}T23:59:59Z`);
  need(
    Number.isFinite(utc) && new Date(utc).toISOString().slice(0, 10) === date,
    "Invalid date.",
  );
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const apparent = Date.parse(
      `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:${v.second}Z`,
    );
    utc += Date.parse(`${date}T23:59:59Z`) - apparent;
  }
  return new Date(utc).toISOString();
}
export function publishDoc(state, member, members, doc, input, workspace) {
  need(canEdit(member, doc), "You cannot publish this procedure.", 403);
  need(
    input.key && String(input.key).length <= 100,
    "A publication identifier is required.",
  );
  const previous = doc.versions.find((v) => v.key === input.key);
  if (previous) {
    need(
      previous.requestHash === hash(input),
      "Publication identifier was reused for different content.",
      409,
    );
    return doc;
  }
  const c = doc.candidate;
  need(
    c?.status === "Approved" && c.approval,
    "Obtain approval before publication.",
    409,
  );
  need(
    c.revision === input.revision && doc.current === input.current,
    "The candidate or current version changed. Refresh before publishing.",
    409,
  );
  const reviewer = members.find(
    (x) => x.id === c.approval.reviewer && x.active && author(x),
  );
  need(
    reviewer && !c.editors.includes(reviewer.id),
    "The reviewer is no longer eligible. Obtain a new approval.",
    409,
  );
  need(
    members.some((m) => m.id === doc.owner && m.active && author(m)),
    "Assign an active process owner before publication.",
    409,
  );
  need(
    c.approval.hash === hash({ title: doc.title, content: c.content }),
    "Content changed after approval.",
    409,
  );
  contentCheck(c.content, true);
  need(
    input.confirmed === true,
    "Confirm that you checked the approved procedure.",
  );
  if (doc.current)
    need(
      String(input.summary || "").trim(),
      "Describe the changes in this version.",
    );
  const due = new Date(input.reviewDue);
  need(
    Number.isFinite(due.getTime()) &&
      due.getTime() > Date.now() + 6 * 86400000 &&
      due.getTime() < Date.now() + 366 * 86400000,
    "Choose a review date from seven to 365 days ahead.",
  );
  const version = {
    id: id(),
    number: doc.current + 1,
    title: doc.title,
    content: structuredClone(c.content),
    sources: c.sources,
    sourceRefs: structuredClone(c.sourceRefs),
    gaps: structuredClone(c.gaps),
    approval: structuredClone(c.approval),
    publisher: member.name,
    published: now(),
    summary: String(input.summary || "Initial publication").slice(0, 2000),
    key: input.key,
    requestHash: hash(input),
  };
  for (const a of state.assignments.filter(
    (x) => x.doc === doc.id && x.status === "Pending",
  ))
    a.status = "Superseded";
  doc.versions.push(version);
  doc.current = version.number;
  doc.candidate = null;
  doc.archived = false;
  doc.reviewDue = due.toISOString();
  doc.updated = now();
  if (input.requireAcknowledgement) {
    const recipients =
      input.recipients === "all"
        ? members.filter((x) => x.active).map((x) => x.id)
        : input.recipients;
    need(
      Array.isArray(recipients) && recipients.length,
      "Select at least one recipient.",
    );
    const deadline = localDeadline(input.deadline, workspace.timezone);
    need(
      Date.parse(deadline) > Date.now() &&
        Date.parse(deadline) < Date.now() + 31 * 86400000,
      "Choose an acknowledgement date within 30 days.",
    );
    assignDoc(state, member, members, doc, { recipients, deadline }, false);
  }
  event(state, member, "Published procedure", doc.id, {
    version: version.number,
  });
  return doc;
}
export function assignDoc(state, member, members, doc, input, record = true) {
  need(canEdit(member, doc), "You cannot assign this procedure.", 403);
  need(doc.current && !doc.archived, "Publish an active procedure first.");
  need(
    Array.isArray(input.recipients) && input.recipients.length,
    "Select at least one recipient.",
  );
  const deadline = input.deadline;
  need(
    Number.isFinite(Date.parse(deadline)) &&
      Date.parse(deadline) > Date.now() &&
      Date.parse(deadline) < Date.now() + 31 * 86400000,
    "Choose a deadline within 30 days.",
  );
  const added = [];
  for (const recipient of new Set(input.recipients)) {
    need(
      members.some((x) => x.id === recipient && x.active),
      "One recipient is no longer active.",
    );
    const existing = state.assignments.find(
      (a) =>
        a.doc === doc.id && a.version === doc.current && a.member === recipient,
    );
    if (existing) {
      if (!existing.receipt && existing.status === "Cancelled") {
        existing.status = "Pending";
        existing.deadline = deadline;
        event(state, member, "Reassigned reader", doc.id, {
          version: doc.current,
          assignment: existing.id,
          recipient,
          deadline,
        });
        notify(
          state,
          members,
          [recipient],
          "A procedure is ready to read",
          current(doc)?.title || doc.title,
          doc.id,
          `reassign-${existing.id}-${deadline}`,
        );
      } else if (
        existing.status === "Pending" &&
        existing.deadline !== deadline
      ) {
        const previousDeadline = existing.deadline;
        existing.deadline = deadline;
        event(state, member, "Updated reading deadline", doc.id, {
          version: doc.current,
          assignment: existing.id,
          recipient,
          previousDeadline,
          deadline,
        });
        notify(
          state,
          members,
          [recipient],
          "Your reading deadline changed",
          current(doc)?.title || doc.title,
          doc.id,
          `deadline-${existing.id}-${deadline}`,
        );
      }
      continue;
    }
    const a = {
      id: id(),
      doc: doc.id,
      version: doc.current,
      member: recipient,
      deadline,
      status: "Pending",
      receipt: null,
      created: now(),
    };
    state.assignments.push(a);
    added.push(recipient);
  }
  notify(
    state,
    members,
    added,
    "A procedure is ready to read",
    current(doc)?.title || doc.title,
    doc.id,
    `publish-${doc.id}-${doc.current}`,
  );
  if (record)
    event(state, member, "Assigned readers", doc.id, { version: doc.current });
  return doc;
}
export function acknowledge(state, member, doc, input) {
  const assignment = state.assignments.find(
    (a) =>
      a.doc === doc.id && a.version === input.version && a.member === member.id,
  );
  need(assignment, "This version is not assigned to you.", 403);
  if (assignment.receipt) return assignment.receipt;
  need(
    !doc.archived &&
      doc.current === input.version &&
      assignment.status === "Pending",
    "This version is no longer current. Read the current procedure.",
    409,
  );
  need(
    input.confirmed === true,
    "Confirm that you have read and understood this version.",
  );
  assignment.status = "Acknowledged";
  assignment.receipt = {
    id: id(),
    version: input.version,
    member: member.id,
    time: now(),
    text: "I have read and understood this version.",
  };
  event(state, member, "Acknowledged procedure", doc.id, {
    version: input.version,
  });
  return assignment.receipt;
}
export function revise(state, member, doc) {
  need(canEdit(member, doc), "You cannot revise this procedure.", 403);
  need(!doc.candidate, "A working revision already exists.", 409);
  const v = current(doc);
  need(v, "No published version exists.");
  doc.candidate = {
    id: id(),
    revision: 1,
    status: "Draft",
    content: structuredClone(v.content),
    sources: v.sources || "",
    gaps: [],
    sourceRefs: structuredClone(v.sourceRefs || []),
    editors: [],
    reviewer: null,
    submission: null,
    approval: null,
    feedback: "",
  };
  event(
    state,
    member,
    doc.archived ? "Started restoration" : "Started revision",
    doc.id,
    { version: doc.current },
  );
  return doc;
}
export function archive(state, member, doc, reason, key) {
  need(admin(member), "Only an administrator can archive procedures.", 403);
  need(String(reason || "").trim(), "Give an archive reason.");
  need(
    String(reason).length <= 2000,
    "Use an archive reason of up to 2,000 characters.",
  );
  if (key !== undefined)
    need(
      typeof key === "string" && key.length > 0 && key.length <= 100,
      "Use a valid archive identifier.",
    );
  const requestHash = hash({ reason: String(reason).trim() });
  const previous =
    key && doc.archiveOperations?.find((operation) => operation.key === key);
  if (previous) {
    need(
      previous.requestHash === requestHash,
      "Archive identifier was reused for a different request.",
      409,
    );
    return doc;
  }
  if (doc.archived) {
    need(
      doc.archiveReason === String(reason).trim(),
      "This procedure is already archived with a different reason.",
      409,
    );
    return doc;
  }
  doc.archived = true;
  doc.archiveReason = String(reason).trim();
  if (key) {
    doc.archiveOperations ??= [];
    doc.archiveOperations.push({
      id: id(),
      key,
      requestHash,
      version: doc.current,
      time: now(),
      actor: member.id,
    });
  }
  if (doc.candidate) {
    doc.candidate.status = "Draft";
    doc.candidate.approval = null;
    doc.candidate.reviewer = null;
    doc.candidate.submission = null;
  }
  for (const proposal of doc.proposals.filter((job) =>
    ["Queued", "Generating"].includes(job.status),
  ))
    proposal.status = "Cancelled";
  for (const a of state.assignments.filter(
    (x) => x.doc === doc.id && x.status === "Pending",
  ))
    a.status = "Cancelled";
  event(state, member, "Archived procedure", doc.id);
  return doc;
}
export function initialState() {
  return {
    documents: [],
    assignments: [],
    notifications: [],
    audit: [],
    maintenance: [],
    generationUsage: [],
  };
}
