import express from "express";
import cookieParser from "cookie-parser";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { randomBytes } from "node:crypto";
import { inflateSync, crc32 } from "node:zlib";
import { resolve, join } from "node:path";
import * as D from "./domain.mjs";
import { digest, passwordHash, passwordValid } from "./db.mjs";
import { reviewAccess } from "./review.mjs";
import {
  generateProposal,
  AI_PROMPT_VERSION,
  AI_VALIDATOR_VERSION,
  validateGeneratedProposal,
} from "./ai.mjs";

const runningGenerations = new WeakMap();
const reviewSandboxes = new WeakMap();

function mergedProposal(candidate, proposal) {
  const content = D.contentCheck(
    proposal.section
      ? {
          ...candidate.content,
          [proposal.section]: proposal.output.content[proposal.section],
        }
      : structuredClone(proposal.output.content),
  );
  const gaps = (candidate.gaps || []).map((gap, index) => ({
    ...structuredClone(gap),
    sourceEvidence: D.gapSourceEvidence(candidate, gap, index),
  }));
  const gapKey = (gap) =>
    D.hash({ field: gap.field, question: gap.question.trim().toLowerCase() });
  const mapping = proposal.output.gaps.map((gap) => {
    const previous = gaps.findIndex((entry) => gapKey(entry) === gapKey(gap));
    if (previous !== -1) {
      gaps[previous] = {
        ...gaps[previous],
        blocking: gaps[previous].blocking || gap.blocking,
      };
      return previous;
    }
    const index = proposal.output.gaps.indexOf(gap);
    const sourceEvidence = proposal.output.sourceRefs
      .filter((ref) => ref.field === `gaps.${index}`)
      .flatMap((ref) => ref.sourceIds)
      .map((sourceId) =>
        D.sourceBlocks(proposal.request.sourceSnapshot).find(
          (block) => block.id === sourceId,
        ),
      )
      .filter(Boolean);
    gaps.push({ ...structuredClone(gap), sourceEvidence });
    return gaps.length - 1;
  });
  D.need(
    gaps.length <= 100,
    "This proposal would exceed 100 open questions. Resolve earlier questions before accepting.",
  );
  const retained = (candidate.sourceRefs || []).filter(
    (ref) =>
      ref.field.startsWith("gaps.") ||
      (proposal.section && ref.field.split(".")[0] !== proposal.section),
  );
  const incoming = proposal.output.sourceRefs
    .filter(
      (ref) =>
        ref.field.startsWith("gaps.") ||
        !proposal.section ||
        ref.field.split(".")[0] === proposal.section,
    )
    .map((ref) =>
      ref.field.startsWith("gaps.")
        ? { ...ref, field: `gaps.${mapping[Number(ref.field.split(".")[1])]}` }
        : ref,
    );
  const sourceRefs = [];
  for (const ref of [...retained, ...incoming]) {
    const existing = sourceRefs.find((entry) => entry.field === ref.field);
    if (existing)
      existing.sourceIds = [
        ...new Set([...existing.sourceIds, ...ref.sourceIds]),
      ];
    else sourceRefs.push(structuredClone(ref));
  }
  D.need(
    sourceRefs.length <= 500,
    "This proposal would exceed the source reference limit.",
  );
  for (const resolution of proposal.output.grounding?.resolutions || []) {
    const clarification = (proposal.request.clarifications || []).find(
      (decision) =>
        decision.gap === resolution.gap &&
        decision.answer === resolution.answer,
    );
    if (!clarification || !D.definitiveResolution(resolution.answer)) continue;
    const group = D.hash([...new Set(resolution.clauseIds)].sort());
    for (const gap of gaps.filter((gap) => gap.kind === "conflict")) {
      const bound = D.rebindClauseIds(
        gap.clauseIds,
        gap.sourceEvidence || gap.resolutionEvidence || [],
        proposal.request.sourceSnapshot,
      );
      if (
        !bound.length ||
        bound.length !== gap.clauseIds.length ||
        D.hash([...new Set(bound)].sort()) !== group
      )
        continue;
      gap.resolution = resolution.answer;
      gap.resolvedBy = clarification.actor;
      gap.resolvedAt = clarification.time;
      gap.resolutionEvidence = structuredClone(gap.sourceEvidence);
      gap.resolutionFromGap = clarification.gap;
    }
  }
  for (const clarification of proposal.request.clarifications || []) {
    const gap = gaps.find((entry) => entry.id === clarification.gap);
    if (!gap) continue;
    gap.acceptedClarifications ??= [];
    if (
      !gap.acceptedClarifications.some(
        (entry) => entry.answer === clarification.answer,
      )
    )
      gap.acceptedClarifications.push({
        answer: clarification.answer,
        sourceText: D.sourceBlocks(proposal.request.sourceSnapshot).find(
          (source) => source.id === clarification.sourceId,
        )?.text,
      });
  }
  return { content, gaps, sourceRefs };
}

function validatePng(bytes) {
  D.need(
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "The logo is not a valid PNG.",
  );
  let offset = 8,
    header,
    ended = false;
  const data = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString("ascii", offset + 4, offset + 8);
    D.need(length <= bytes.length - offset - 12, "The logo PNG is truncated.");
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    D.need(
      crc32(bytes.subarray(offset + 4, offset + 8 + length)) ===
        bytes.readUInt32BE(offset + 8 + length),
      "The logo PNG contains a damaged chunk.",
    );
    if (type === "IHDR") {
      D.need(
        !header && offset === 8 && length === 13,
        "The logo PNG has an invalid header.",
      );
      header = payload;
    } else if (type === "IDAT") data.push(payload);
    else if (type === "IEND") {
      D.need(length === 0, "The logo PNG has an invalid ending.");
      ended = true;
    }
    offset += length + 12;
    if (ended) break;
  }
  D.need(
    header && ended && offset === bytes.length && data.length,
    "The logo PNG is incomplete.",
  );
  const width = header.readUInt32BE(0),
    height = header.readUInt32BE(4),
    bits = header[8],
    color = header[9],
    interlace = header[12];
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  D.need(
    width > 0 && height > 0 && width <= 4096 && height <= 4096,
    "Use a logo no larger than 4096 × 4096 pixels.",
  );
  D.need(
    channels &&
      [1, 2, 4, 8, 16].includes(bits) &&
      (![2, 4, 6].includes(color) || bits >= 8) &&
      (color !== 3 || bits <= 8) &&
      header[10] === 0 &&
      header[11] === 0 &&
      interlace <= 1,
    "The logo PNG uses an invalid pixel format.",
  );
  const passes = interlace
    ? [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
      ]
    : [[0, 0, 1, 1]];
  const layouts = passes
    .map(([x, y, dx, dy]) => ({
      width: Math.max(0, Math.ceil((width - x) / dx)),
      height: Math.max(0, Math.ceil((height - y) / dy)),
    }))
    .filter((pass) => pass.width && pass.height)
    .map((pass) => ({
      ...pass,
      stride: Math.ceil((pass.width * channels * bits) / 8) + 1,
    }));
  const expected = layouts.reduce(
    (total, pass) => total + pass.stride * pass.height,
    0,
  );
  let pixels;
  try {
    pixels = inflateSync(Buffer.concat(data), { maxOutputLength: expected });
  } catch {
    throw new D.Problem("The logo PNG contains damaged image data.");
  }
  D.need(pixels.length === expected, "The logo PNG has incomplete image data.");
  let position = 0;
  for (const pass of layouts)
    for (let row = 0; row < pass.height; row++) {
      D.need(pixels[position] <= 4, "The logo PNG has an invalid row filter.");
      position += pass.stride;
    }
}

function documentSummary(doc, member) {
  const permitted = D.canDraft(member, doc);
  return {
    id: doc.id,
    title: permitted ? doc.title : D.current(doc)?.title || doc.title,
    category: doc.category,
    department: doc.department || "",
    owner: doc.owner,
    created: doc.created,
    updated: doc.updated,
    current: doc.current,
    archived: doc.archived,
    reviewDue: doc.reviewDue,
    demo: doc.demo,
    status: doc.archived
      ? "Archived"
      : (permitted ? doc.candidate?.status : null) || "Published",
    draftStatus: permitted ? doc.candidate?.status : null,
    reviewer: permitted ? doc.candidate?.reviewer : null,
    stepCount:
      D.current(doc)?.content.steps.length ||
      (permitted ? doc.candidate?.content.steps.length : 0) ||
      0,
  };
}

function documentPage(workspace, member, query) {
  const q = String(query.q || "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const visible = workspace.state.documents.filter(
    (doc) => D.canDraft(member, doc) || (!doc.archived && doc.current),
  );
  const categories = [
    ...new Set(
      visible.filter((doc) => !doc.archived).map((doc) => doc.category),
    ),
  ].sort();
  const owners = [...new Set(visible.map((doc) => doc.owner))];
  const departments = [
    ...new Set(
      visible
        .filter((doc) => !doc.archived)
        .map((doc) => doc.department)
        .filter(Boolean),
    ),
  ].sort();
  const rows = visible
    .filter((doc) => {
      const summary = documentSummary(doc, member);
      const status = query.status || "All procedures";
      if (status === "Archived" ? !doc.archived : doc.archived) return false;
      if (status === "Published" && !doc.current) return false;
      if (
        status === "My drafts" &&
        !(doc.owner === member.id && summary.draftStatus)
      )
        return false;
      if (
        !["All procedures", "Published", "My drafts", "Archived"].includes(
          status,
        ) &&
        summary.status !== status
      )
        return false;
      if (
        query.view === "reviews" &&
        !(summary.reviewer === member.id && summary.status === "In review")
      )
        return false;
      if (
        query.category &&
        query.category !== "All categories" &&
        doc.category !== query.category
      )
        return false;
      if (query.owner && query.owner !== "all" && doc.owner !== query.owner)
        return false;
      if (
        query.department &&
        query.department !== "all" &&
        doc.department !== query.department
      )
        return false;
      if (
        query.reviewDue === "due" &&
        !(doc.current && doc.reviewDue && doc.reviewDue < D.now())
      )
        return false;
      if (!q) return true;
      const content =
        D.canDraft(member, doc) && doc.candidate
          ? doc.candidate.content
          : D.current(doc)?.content;
      const text = content
        ? [
            content.purpose,
            content.scope,
            content.responsibilities,
            content.prerequisites,
            content.exceptions,
            content.completion,
            ...(content.steps || []).flatMap((step) => [
              step.title,
              step.body,
              step.responsible,
            ]),
            ...(content.checklist || []),
          ].join(" ")
        : "";
      return `${summary.title} ${text}`.toLowerCase().includes(q);
    })
    .sort(
      (a, b) => b.updated.localeCompare(a.updated) || a.id.localeCompare(b.id),
    );
  const pageSize = Math.max(
    1,
    Math.min(100, Math.trunc(Number(query.pageSize) || 24)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.max(
    1,
    Math.min(pages, Math.trunc(Number(query.page) || 1)),
  );
  const documents = rows
    .slice((page - 1) * pageSize, page * pageSize)
    .map((doc) => documentSummary(doc, member));
  return {
    documents,
    ids: documents.map((doc) => doc.id),
    total: rows.length,
    page,
    pageSize,
    pages,
    categories,
    departments,
    owners,
  };
}

export function createApp(store, config = {}) {
  const app = express();
  const prod = config.production ?? process.env.NODE_ENV === "production";
  const review = config.review ?? process.env.REVIEW_MODE === "true";
  const sandbox = review
    ? reviewAccess(store, prod, (workspace) => {
        for (const [job, execution] of runningGenerations.get(store) || []) {
          if (execution.workspace === workspace) {
            execution.controller.abort(
              new DOMException(
                "Review sandbox expired or was reset",
                "AbortError",
              ),
            );
            runningGenerations.get(store).delete(job);
          }
        }
      })
    : null;
  if (sandbox) reviewSandboxes.set(store, sandbox);
  const demo =
    review || (!prod && (config.demo ?? process.env.DEMO_MODE === "true"));
  const url = config.url || process.env.APP_URL || "http://localhost:4197";
  const ai = config.generate || generateProposal;
  const generationControllers = new Map();
  runningGenerations.set(store, generationControllers);
  const abortCancelledJobs = (workspaceId) => {
    const state = store.read(workspaceId)?.state;
    const locked = new Set();
    for (const [jobId, execution] of generationControllers) {
      if (execution.workspace !== workspaceId) continue;
      const doc = state?.documents.find((doc) => doc.id === execution.document);
      const job = doc?.proposals.find((job) => job.id === jobId);
      if (
        job &&
        ["Queued", "Generating"].includes(job.status) &&
        (!doc.candidate ||
          doc.candidate.id !== job.candidate ||
          !["Draft", "Changes requested"].includes(doc.candidate.status))
      )
        locked.add(jobId);
    }
    if (locked.size)
      store.transaction(workspaceId, (w, s) => {
        for (const doc of s.documents)
          for (const job of doc.proposals.filter((job) => locked.has(job.id))) {
            job.status = "Cancelled";
            job.completed = D.now();
            job.cancellationReason = "The draft was locked or replaced.";
          }
      });
    for (const [jobId, execution] of generationControllers) {
      if (execution.workspace !== workspaceId) continue;
      const job = state?.documents
        .find((doc) => doc.id === execution.document)
        ?.proposals.find((job) => job.id === jobId);
      if (
        !job ||
        !["Queued", "Generating"].includes(job.status) ||
        locked.has(jobId)
      )
        execution.controller.abort(
          new DOMException("Generation was cancelled", "AbortError"),
        );
    }
  };
  const aiDisabled =
    process.env.AI_DISABLED === "true" ||
    (prod && process.env.AI_DISABLED !== "false");
  const aiAvailable =
    !!(process.env.SARVAM_API_KEY || config.generate) && !aiDisabled;
  app.disable("x-powered-by");
  app.use(express.json({ limit: "3mb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (prod)
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.path.startsWith("/api")
    ) {
      const origin = req.headers.origin;
      const host = `${req.protocol}://${req.headers.host}`;
      if (
        req.headers["x-sopeasy-request"] !== "1" ||
        (origin && origin !== new URL(url).origin && origin !== host)
      )
        return res
          .status(403)
          .json({ error: "This request did not originate from SOPEasy." });
    }
    next();
  });
  const mailer = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    : null;
  async function mail(email, subject, link) {
    if (mailer)
      await mailer.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject,
        text: `${subject}\n\n${link}\n\nOnly use this link if you requested it.`,
      });
    else {
      D.need(!prod, "Email delivery is not configured.", 503);
      store.run(
        "INSERT INTO outbox VALUES(?,?,?,?,?)",
        D.id(),
        email,
        subject,
        link,
        D.now(),
      );
    }
  }
  function token(user, kind, hours = 24) {
    const raw = randomBytes(32).toString("hex");
    store.run(
      "INSERT INTO tokens VALUES(?,?,?,?)",
      digest(raw),
      user,
      kind,
      new Date(Date.now() + hours * 3600000).toISOString(),
    );
    return raw;
  }
  function session(res, user) {
    const raw = randomBytes(32).toString("hex");
    store.run(
      "INSERT INTO sessions VALUES(?,?,?)",
      digest(raw),
      user.id,
      new Date(Date.now() + (review ? 3 : 7) * 86400000).toISOString(),
    );
    res.cookie("sopeasy_session", raw, {
      httpOnly: true,
      sameSite: "lax",
      secure: prod,
      maxAge: (review ? 3 : 7) * 86400000,
      path: "/",
    });
  }
  function auth(req, res, next) {
    try {
      const user = store.get(
        "SELECT u.* FROM sessions s JOIN users u ON s.user=u.id WHERE s.token=? AND s.expires>?",
        digest(req.cookies.sopeasy_session || ""),
        D.now(),
      );
      D.need(user && user.verified, "Sign in to continue.", 401);
      if (review)
        D.need(
          sandbox.lookup(req)?.people.some((p) => p.id === user.id),
          "Open your review workspace again.",
          401,
        );
      req.user = { id: user.id, name: user.name, email: user.email };
      next();
    } catch (e) {
      next(e);
    }
  }
  function membership(req, res, next) {
    try {
      const wid = req.params.wid;
      const member = store
        .members(wid)
        .find((x) => x.user === req.user.id && x.active);
      D.need(member, "Workspace access is unavailable.", 403);
      const w = store.read(wid);
      D.need(w, "Workspace not found.", 404);
      D.need(
        !w.deletion || req.path.endsWith("/recovery"),
        "This workspace is pending deletion.",
        423,
      );
      req.member = member;
      req.workspace = w;
      next();
    } catch (e) {
      next(e);
    }
  }
  function mutate(req, fn) {
    return store.transaction(req.params.wid, (w, s) => {
      const m = store
        .members(w.id)
        .find((x) => x.user === req.user.id && x.active);
      D.need(m, "Your workspace access was removed.", 403);
      D.need(!w.deletion, "This workspace is disabled.", 423);
      return fn(w, s, m, store.members(w.id));
    });
  }
  const authAttempts = new Map();
  app.use("/api/auth", (req, res, next) => {
    const ip =
      review && sandbox.lookup(req)
        ? `review:${digest(req.cookies.sopeasy_review)}`
        : req.ip;
    const v = authAttempts.get(ip) || { count: 0, start: Date.now() };
    if (Date.now() - v.start > 3600000) {
      v.count = 0;
      v.start = Date.now();
    }
    v.count++;
    authAttempts.set(ip, v);
    if (v.count > 120)
      return res
        .status(429)
        .json({ error: "Too many account requests. Try again later." });
    next();
  });
  app.get("/api/health", (req, res) => {
    store.get("SELECT 1");
    res.json({ ok: true, product: "SOPEasy", storage: "ready" });
  });
  app.get("/api/config", (req, res) =>
    res.json({
      demo,
      review,
      ai: aiAvailable,
      email: !!mailer,
    }),
  );
  app.use("/api/auth", (req, res, next) => {
    if (
      review &&
      !["/review", "/demo", "/logout", "/review-reset"].includes(req.path)
    )
      return res.status(403).json({
        error:
          "This review build uses sample roles. Account registration and email delivery are disabled.",
      });
    next();
  });
  app.post("/api/auth/review", (req, res) => {
    D.need(review, "Review access is disabled.", 404);
    const visit = sandbox.open(req, res);
    session(res, visit.people[0]);
    res.json({ ok: true, workspace: visit.workspace });
  });
  app.post("/api/auth/review-reset", (req, res) => {
    D.need(review, "Review access is disabled.", 404);
    sandbox.reset(req, res);
    res.clearCookie("sopeasy_session", { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/auth/login", (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const user = store.get("SELECT * FROM users WHERE email=?", email);
    D.need(
      user && passwordValid(String(req.body.password || ""), user.password),
      "Email or password is incorrect.",
      401,
    );
    D.need(user.verified, "Verify your email before signing in.", 403);
    session(res, user);
    res.json({ ok: true });
  });
  app.post("/api/auth/demo", (req, res) => {
    D.need(demo, "Demonstration access is disabled.", 404);
    const email = req.body.email;
    D.need(
      [
        "maya@sopeasy.example",
        "arjun@sopeasy.example",
        "leena@sopeasy.example",
      ].includes(email),
      "Unknown demonstration account.",
    );
    const user = review
      ? sandbox
          .lookup(req)
          ?.people.find((p) => p.email.split("+")[0] === email.split("@")[0])
      : store.get("SELECT * FROM users WHERE email=?", email);
    D.need(user, "Open your review workspace first.", 404);
    if (review)
      D.need(
        store
          .members(sandbox.lookup(req).workspace)
          .some((m) => m.user === user.id && m.active),
        "This sample role is inactive. Return to the owner role or start a fresh sandbox.",
        403,
      );
    session(res, user);
    res.json({ ok: true });
  });
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { name, password } = req.body;
      const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
      D.need(
        typeof name === "string" && name.trim() && name.length <= 100,
        "Enter your name.",
      );
      D.need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Enter a valid email.");
      D.need(
        typeof password === "string" &&
          password.length >= 12 &&
          password.length <= 200,
        "Use a password with 12 to 200 characters.",
      );
      D.need(
        !store.get("SELECT id FROM users WHERE email=?", email),
        "An account already uses this email.",
        409,
      );
      D.need(!prod || mailer, "Email delivery is not configured.", 503);
      const user = { id: D.id(), name: name.trim(), email };
      store.run(
        "INSERT INTO users VALUES(?,?,?,?,0)",
        user.id,
        user.name,
        email,
        passwordHash(password),
      );
      const invite = /^[a-f0-9]{64}$/.test(req.body.invite || "")
        ? `&invite=${req.body.invite}`
        : "";
      const link = `${url}/?verify=${token(user.id, "verify")}${invite}`;
      await mail(email, "Verify your SOPEasy email", link);
      res.json({
        ok: true,
        message: "Check your email to verify your account.",
        ...(!prod ? { developmentLink: link } : {}),
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/verify", (req, res) => {
    const t = store.get(
      "SELECT * FROM tokens WHERE token=? AND kind=? AND expires>?",
      digest(String(req.body.token || "")),
      "verify",
      D.now(),
    );
    D.need(t, "This verification link expired or was used.");
    D.need(
      !store.get("SELECT verified FROM users WHERE id=?", t.user)?.verified,
      "This verification link expired or was used.",
    );
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.run("UPDATE users SET verified=1 WHERE id=?", t.user);
      store.run("DELETE FROM tokens WHERE user=? AND kind=?", t.user, "verify");
      store.db.exec("COMMIT");
    } catch (e) {
      store.db.exec("ROLLBACK");
      throw e;
    }
    const user = store.get("SELECT * FROM users WHERE id=?", t.user);
    session(res, user);
    res.json({ ok: true });
  });
  app.post("/api/auth/forgot", async (req, res, next) => {
    try {
      const user = store.get(
        "SELECT * FROM users WHERE email=?",
        String(req.body.email || "")
          .trim()
          .toLowerCase(),
      );
      let link;
      if (user) {
        link = user.verified
          ? `${url}/?reset=${token(user.id, "reset", 1)}`
          : `${url}/?verify=${token(user.id, "verify")}`;
        await mail(
          user.email,
          user.verified
            ? "Reset your SOPEasy password"
            : "Verify your SOPEasy email",
          link,
        );
      }
      res.json({
        message:
          "If this account exists, an account recovery link is on its way.",
        ...(!prod && link ? { developmentLink: link } : {}),
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/reset", (req, res) => {
    const t = store.get(
      "SELECT * FROM tokens WHERE token=? AND kind=? AND expires>?",
      digest(String(req.body.token || "")),
      "reset",
      D.now(),
    );
    D.need(t, "This reset link expired or was used.");
    D.need(
      typeof req.body.password === "string" &&
        req.body.password.length >= 12 &&
        req.body.password.length <= 200,
      "Use a password with 12 to 200 characters.",
    );
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.run(
        "UPDATE users SET password=? WHERE id=?",
        passwordHash(req.body.password),
        t.user,
      );
      store.run("DELETE FROM tokens WHERE user=? AND kind=?", t.user, "reset");
      store.run("DELETE FROM sessions WHERE user=?", t.user);
      store.db.exec("COMMIT");
    } catch (e) {
      store.db.exec("ROLLBACK");
      throw e;
    }
    res.json({ ok: true });
  });
  app.post("/api/auth/logout", (req, res) => {
    store.run(
      "DELETE FROM sessions WHERE token=?",
      digest(req.cookies.sopeasy_session || ""),
    );
    res.clearCookie("sopeasy_session", { path: "/" });
    res.json({ ok: true });
  });
  app.use("/api", auth);
  app.get("/api/bootstrap", (req, res) => {
    const workspaces = store.all(
      "SELECT w.id,w.name,w.timezone,w.logo,w.deletion,m.role FROM workspaces w JOIN memberships m ON m.workspace=w.id WHERE m.user=? AND m.active=1",
      req.user.id,
    );
    const selected =
      workspaces.find((w) => w.id === req.query.workspace) || workspaces[0];
    if (!selected)
      return res.json({ user: req.user, workspaces, workspace: null });
    const members = store.members(selected.id);
    const member = members.find((x) => x.user === req.user.id);
    const w = store.read(selected.id);
    if (w.deletion)
      return res.json({
        user: req.user,
        workspaces,
        workspace: { ...selected, member },
        members: [],
        documents: [],
        tasks: [],
        notifications: [],
        audit: [],
        templates: D.templates,
        disabled: true,
      });
    const docs = w.state.documents.filter(
      (doc) => D.canDraft(member, doc) || (!doc.archived && doc.current),
    );
    const attention = docs.filter(
      (doc) =>
        !doc.archived &&
        ((doc.candidate?.reviewer === member.id &&
          doc.candidate.status === "In review") ||
          (doc.owner === member.id &&
            doc.candidate?.status === "Changes requested") ||
          (doc.current &&
            doc.owner === member.id &&
            doc.reviewDue &&
            doc.reviewDue < D.now())),
    );
    const recent = [...docs]
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, 40);
    const selectedDocs = [
      ...new Map(
        [...attention.slice(0, 12), ...recent].map((doc) => [doc.id, doc]),
      ).values(),
    ];
    const myTasks = w.state.assignments.filter(
      (task) => task.member === member.id && task.status === "Pending",
    );
    const targetInfo = (entry) => {
      const doc = w.state.documents.find((doc) => doc.id === entry.target);
      const visible = doc && (D.canDraft(member, doc) || doc.current);
      return {
        ...entry,
        documentTarget: !!visible,
        targetTitle: visible ? documentSummary(doc, member).title : undefined,
      };
    };
    res.json({
      user: req.user,
      workspaces,
      workspace: { ...selected, member },
      members: members.map((x) => ({
        id: x.id,
        name: x.name,
        email: D.admin(member) ? x.email : undefined,
        role: x.role,
        active: x.active,
      })),
      documents: selectedDocs.map((doc) => documentSummary(doc, member)),
      summary: {
        published: docs.filter((doc) => doc.current && !doc.archived).length,
        drafts: docs.filter(
          (doc) => D.canDraft(member, doc) && doc.candidate && !doc.archived,
        ).length,
        reviews: docs.filter(
          (doc) =>
            doc.candidate?.reviewer === member.id &&
            doc.candidate.status === "In review" &&
            !doc.archived,
        ).length,
        attention: attention.length,
        pendingReading: myTasks.length,
        overdueReading: myTasks.filter((task) => task.deadline < D.now())
          .length,
      },
      categories: [
        ...new Set(
          docs.filter((doc) => !doc.archived).map((doc) => doc.category),
        ),
      ].sort(),
      departments: [
        ...new Set(
          docs
            .filter((doc) => !doc.archived)
            .map((doc) => doc.department)
            .filter(Boolean),
        ),
      ].sort(),
      tasks: w.state.assignments
        .filter(
          (x) =>
            D.admin(member) ||
            x.member === member.id ||
            w.state.documents.some(
              (d) => d.id === x.doc && d.owner === member.id,
            ),
        )
        .map((task) => {
          const doc = w.state.documents.find((doc) => doc.id === task.doc);
          return {
            ...task,
            title:
              doc?.versions.find((version) => version.number === task.version)
                ?.title ||
              (doc && D.canDraft(member, doc)
                ? doc.title
                : "Procedure unavailable"),
          };
        }),
      notifications: w.state.notifications
        .filter((x) => x.member === member.id)
        .slice(0, 100)
        .map((notification) => {
          const doc = w.state.documents.find(
            (doc) => doc.id === notification.target,
          );
          const safe =
            doc && !D.canDraft(member, doc)
              ? {
                  ...notification,
                  message: D.current(doc)?.title || "Procedure unavailable",
                }
              : notification;
          return targetInfo(safe);
        }),
      audit: (D.admin(member)
        ? w.state.audit.slice(0, 100)
        : w.state.audit.filter((e) => e.actorId === member.id).slice(0, 30)
      ).map(targetInfo),
      templates: D.templates,
      config: {
        demo,
        review,
        ai: aiAvailable,
        aiValidatorVersion: AI_VALIDATOR_VERSION,
        email: !!mailer,
      },
    });
  });
  app.post("/api/workspaces", (req, res) => {
    D.need(
      !review,
      "The review link already includes your sample workspace.",
      403,
    );
    const name = String(req.body.name || "").trim();
    D.need(name && name.length <= 100, "Choose a workspace name.");
    const timezone = req.body.timezone || "Asia/Calcutta";
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      throw new D.Problem("Choose a valid timezone.");
    }
    const wid = store.createWorkspace(req.user, name, timezone);
    res.json({ id: wid });
  });
  app.get("/api/invitation/:token", (req, res) => {
    const i = store.get(
      "SELECT i.*,w.name FROM invites i JOIN workspaces w ON w.id=i.workspace WHERE token=?",
      digest(req.params.token),
    );
    D.need(
      i && !i.revoked && !i.accepted && i.expires > D.now(),
      "This invitation expired, was revoked, or was used.",
    );
    D.need(
      i.email === req.user.email,
      "Sign in with the invited email address.",
      403,
    );
    res.json({ name: i.name, role: i.role, workspace: i.workspace });
  });
  app.post("/api/invitation/:token", (req, res) => {
    const i = store.get(
      "SELECT * FROM invites WHERE token=?",
      digest(req.params.token),
    );
    D.need(
      i && !i.revoked && !i.accepted && i.expires > D.now(),
      "This invitation is no longer valid.",
    );
    D.need(i.email === req.user.email, "Use the invited email address.", 403);
    store.transaction(i.workspace, (w, s) => {
      D.need(!w.deletion, "The workspace is disabled.", 423);
      D.need(
        !store.members(w.id).some((m) => m.user === req.user.id && m.active),
        "You already belong to this workspace. Ask an administrator to update your role.",
        409,
      );
      store.run(
        "INSERT INTO memberships(id,workspace,user,role,active) VALUES(?,?,?,?,1) ON CONFLICT(workspace,user) DO UPDATE SET role=excluded.role,active=1",
        D.id(),
        i.workspace,
        req.user.id,
        i.role,
      );
      store.run("UPDATE invites SET accepted=1 WHERE id=?", i.id);
      const m = store.members(i.workspace).find((x) => x.user === req.user.id);
      D.event(s, m, "Accepted invitation", i.workspace);
      D.notify(
        s,
        store.members(i.workspace),
        store
          .members(i.workspace)
          .filter(D.admin)
          .map((x) => x.id),
        "A teammate joined",
        m.name,
        i.workspace,
        `invite-${i.id}`,
      );
    });
    res.json({ workspace: i.workspace });
  });
  app.use("/api/w/:wid", membership);
  app.get("/api/w/:wid/docs", (req, res) => {
    res.json(documentPage(req.workspace, req.member, req.query));
  });
  app.get("/api/w/:wid/search", (req, res) => {
    res.json(documentPage(req.workspace, req.member, req.query));
  });
  app.get("/api/w/:wid/docs/:docId", (req, res) => {
    const doc = D.findDoc(req.workspace.state, req.params.docId);
    const view = D.docView(doc, req.member);
    const assignments = req.workspace.state.assignments.filter(
      (a) =>
        a.doc === doc.id &&
        (D.canEdit(req.member, doc) || a.member === req.member.id),
    );
    res.json({
      doc: view,
      assignments,
      audit: D.canDraft(req.member, doc)
        ? req.workspace.state.audit.filter((x) => x.target === doc.id)
        : [],
    });
  });
  app.post("/api/w/:wid/docs", (req, res) =>
    res.json({ doc: mutate(req, (w, s, m) => D.createDoc(s, m, req.body)) }),
  );
  app.put("/api/w/:wid/docs/:docId", (req, res) =>
    res.json({
      doc: mutate(req, (w, s, m) =>
        D.saveDoc(s, m, D.findDoc(s, req.params.docId), req.body),
      ),
    }),
  );
  app.post("/api/w/:wid/docs/:docId/action", (req, res) => {
    const result = mutate(req, (w, s, m, members) => {
      const doc = D.findDoc(s, req.params.docId);
      const b = req.body;
      switch (b.action) {
        case "submit":
          return D.submitDoc(s, m, members, doc, b);
        case "review":
          return D.reviewDoc(s, m, members, doc, b);
        case "publish":
          return D.publishDoc(s, m, members, doc, b, w);
        case "acknowledge":
          return D.acknowledge(s, m, doc, b);
        case "revise":
          return D.revise(s, m, doc);
        case "restore":
          D.need(
            D.admin(m),
            "Only administrators can restore procedures.",
            403,
          );
          return D.revise(s, m, doc);
        case "archive":
          return D.archive(s, m, doc, b.reason, b.key);
        case "assign":
          return D.assignDoc(s, m, members, doc, {
            ...b,
            deadline: D.localDeadline(b.deadline, w.timezone),
          });
        case "withdraw":
          D.need(
            D.canEdit(m, doc) && doc.candidate?.status === "In review",
            "This submission cannot be withdrawn.",
            403,
          );
          doc.candidate.status = "Draft";
          doc.candidate.reviewer = null;
          doc.candidate.submission = null;
          D.event(s, m, "Withdrew review", doc.id);
          return doc;
        case "editApproved":
          D.need(
            D.canEdit(m, doc) && doc.candidate?.status === "Approved",
            "Cannot reopen this revision.",
            403,
          );
          doc.candidate.status = "Draft";
          doc.candidate.approval = null;
          return doc;
        case "discard":
          D.need(D.canEdit(m, doc), "You cannot discard this revision.", 403);
          D.need(doc.current, "Archive an unpublished procedure instead.");
          doc.candidate = null;
          for (const job of doc.proposals)
            if (["Queued", "Generating"].includes(job.status))
              job.status = "Cancelled";
          D.event(s, m, "Discarded candidate", doc.id);
          return doc;
        case "duplicate":
          D.need(
            D.canDraft(m, doc) || (doc.current && !doc.archived),
            "You cannot duplicate this procedure.",
            403,
          );
          const from =
            D.canDraft(m, doc) && doc.candidate
              ? { ...doc.candidate, title: doc.title }
              : D.current(doc);
          const copy = D.createDoc(s, m, {
            title: `${from.title} copy`.slice(0, 160),
            category: doc.category,
            department: doc.department,
            template: doc.template,
            sources: D.canDraft(m, doc) ? from.sources || "" : "",
          });
          copy.candidate.content = structuredClone(from.content);
          return copy;
        case "maintenance":
          D.need(D.canEdit(m, doc), "You cannot maintain this procedure.", 403);
          D.need(b.note?.trim(), "Record why no content change is needed.");
          D.need(
            Date.parse(b.date) > Date.now() &&
              Date.parse(b.date) < Date.now() + 366 * 86400000,
            "Choose a review date within a year.",
          );
          doc.reviewDue = new Date(b.date).toISOString();
          s.maintenance.push({
            id: D.id(),
            doc: doc.id,
            version: doc.current,
            note: b.note.slice(0, 2000),
            actor: m.id,
            time: D.now(),
            date: doc.reviewDue,
          });
          D.event(s, m, "Reviewed with no change", doc.id, {
            version: doc.current,
          });
          return doc;
        case "transfer":
          D.need(D.admin(m), "Only administrators transfer ownership.", 403);
          D.need(
            members.some((x) => x.id === b.owner && x.active && D.author(x)),
            "Choose an active author.",
          );
          doc.owner = b.owner;
          D.event(s, m, "Transferred ownership", doc.id);
          return doc;
        case "applyProposal":
          D.need(D.canEdit(m, doc), "You cannot apply this proposal.", 403);
          const p = doc.proposals.find((x) => x.id === b.proposal);
          D.need(
            b.confirmed === true,
            "Preview and confirm the proposed replacement.",
          );
          if (p?.status === "Accepted") return doc;
          D.need(
            doc.candidate &&
              ["Draft", "Changes requested"].includes(doc.candidate.status),
            "You cannot apply this proposal.",
            403,
          );
          D.need(p?.status === "Ready", "The proposal is not ready.");
          D.need(
            p.candidate === doc.candidate.id &&
              p.revision === doc.candidate.revision &&
              p.sourceHash === D.hash(doc.candidate.sources),
            "This proposal is stale. Generate against the latest notes.",
            409,
          );
          const c = doc.candidate;
          validateGeneratedProposal(p.output, p.request.sourceSnapshot, {
            section: p.section,
            content: p.request.contentSnapshot || c.content,
            clarifications: p.request.clarifications || [],
            rewriteSources: p.request.rewriteSources || [],
            priorRewriteSources: p.request.priorRewriteSources || [],
            rewriteSourceIds: p.request.rewriteSourceIds || [],
            supersededSourceIds: p.request.supersededSourceIds || [],
          });
          const replacement = mergedProposal(c, p);
          doc.checkpoints.unshift({
            id: D.id(),
            revision: c.revision,
            content: structuredClone(c.content),
            sources: c.sources,
            gaps: structuredClone(c.gaps),
            sourceRefs: structuredClone(c.sourceRefs),
            time: D.now(),
            actor: m.name,
          });
          Object.assign(c, replacement);
          c.sources = p.request.sourceSnapshot;
          c.editors = [...new Set([...c.editors, m.id])];
          c.approval = null;
          c.status = "Draft";
          c.revision++;
          p.status = "Accepted";
          p.acceptance = { actor: m.id, revision: c.revision, time: D.now() };
          doc.updated = D.now();
          doc.checkpoints = doc.checkpoints.slice(0, 100);
          D.event(s, m, "Accepted AI proposal", doc.id, {
            revision: c.revision,
          });
          return doc;
        case "cancelProposal":
          D.need(D.canEdit(m, doc), "You cannot cancel this proposal.", 403);
          const proposal = doc.proposals.find((x) => x.id === b.proposal);
          D.need(proposal, "Proposal not found.");
          D.need(
            proposal.status !== "Accepted",
            "An accepted proposal cannot be cancelled. Recover its previous checkpoint instead.",
            409,
          );
          if (proposal.status === "Cancelled") return doc;
          proposal.status = "Cancelled";
          D.event(s, m, "Cancelled AI proposal", doc.id, {
            proposal: proposal.id,
            revision: proposal.revision,
          });
          return doc;
        case "checkpoint":
          D.need(
            D.canEdit(m, doc) &&
              doc.candidate &&
              doc.candidate.status !== "In review",
            "This revision is locked.",
            403,
          );
          const checkpoint = doc.checkpoints.find((x) => x.id === b.checkpoint);
          D.need(checkpoint, "Checkpoint not found.");
          const recovery = {
            id: D.id(),
            revision: doc.candidate.revision,
            content: structuredClone(doc.candidate.content),
            sources: doc.candidate.sources,
            gaps: structuredClone(doc.candidate.gaps),
            sourceRefs: structuredClone(doc.candidate.sourceRefs),
            time: D.now(),
            actor: m.name,
          };
          const restored = D.saveDoc(s, m, doc, {
            revision: doc.candidate.revision,
            content: checkpoint.content,
            sources: checkpoint.sources,
            checkpoint: false,
          });
          restored.candidate.gaps = structuredClone(checkpoint.gaps || []);
          restored.candidate.sourceRefs = structuredClone(
            checkpoint.sourceRefs || [],
          );
          restored.checkpoints.unshift(recovery);
          restored.checkpoints = restored.checkpoints.slice(0, 100);
          D.event(s, m, "Restored checkpoint", doc.id, {
            revision: restored.candidate.revision,
            checkpoint: checkpoint.id,
            recovery: recovery.id,
          });
          return restored;
        default:
          throw new D.Problem("Unknown document action.");
      }
    });
    abortCancelledJobs(req.params.wid);
    res.json({ result });
  });
  app.post("/api/w/:wid/docs/:docId/generate", (req, res) => {
    const p = mutate(req, (w, s, m) => {
      const doc = D.findDoc(s, req.params.docId);
      D.need(
        D.canEdit(m, doc) &&
          doc.candidate &&
          ["Draft", "Changes requested"].includes(doc.candidate.status),
        "This candidate cannot be generated.",
        403,
      );
      D.need(doc.candidate.sources.trim(), "Add source notes first.");
      D.need(
        req.body.consent === true,
        "Confirm sending this procedure to the AI provider before generation.",
      );
      const key = req.body.key;
      D.need(
        key === undefined ||
          (typeof key === "string" && key.length > 0 && key.length <= 100),
        "Use a valid generation request identifier.",
      );
      const requestHash = D.hash({
        actor: m.id,
        section: req.body.section || null,
        revision: req.body.revision ?? null,
        candidate: req.body.candidate ?? null,
      });
      const previous = key && doc.proposals.find((job) => job.key === key);
      if (previous) {
        D.need(
          previous.requestHash === requestHash,
          "Generation identifier was reused for a different request.",
          409,
        );
        return { ...previous, existing: true };
      }
      D.need(
        req.body.revision === undefined ||
          req.body.revision === doc.candidate.revision,
        "The saved draft changed. Refresh before generating.",
        409,
      );
      D.need(
        req.body.candidate === undefined ||
          req.body.candidate === doc.candidate.id,
        "This candidate was replaced. Refresh before generating.",
        409,
      );
      D.need(
        aiAvailable,
        "AI assistance is unavailable. You can continue drafting manually.",
        503,
      );
      D.need(
        !doc.proposals.some((p) => ["Queued", "Generating"].includes(p.status)),
        "A generation is already running.",
        409,
      );
      D.need(
        s.documents
          .flatMap((d) => d.proposals)
          .filter((p) => p.status === "Generating").length < 3,
        "The workspace already has three active generations.",
        429,
      );
      const hour = Date.now() - 3600000,
        day = Date.now() - 86400000;
      D.need(
        s.generationUsage.filter(
          (x) => x.member === m.id && Date.parse(x.time) > hour,
        ).length < 10 &&
          s.generationUsage.filter((x) => Date.parse(x.time) > day).length <
            100,
        "Generation limit reached. Continue manually or try again later.",
        429,
      );
      const section = req.body.section;
      D.need(
        !section ||
          [
            "purpose",
            "scope",
            "responsibilities",
            "prerequisites",
            "exceptions",
            "completion",
            "steps",
            "checklist",
          ].includes(section),
        "Invalid section.",
      );
      const evidence = D.generationSourceSnapshot(
        doc.candidate,
        section || null,
        doc.proposals,
      );
      if (review) {
        D.need(
          generationControllers.size < 3,
          "The review build already has three active AI requests. Try again shortly.",
          429,
        );
        sandbox.reserveAI();
      }
      const p = {
        id: D.id(),
        key: key || null,
        requestHash,
        status: "Generating",
        revision: doc.candidate.revision,
        sourceHash: D.hash(doc.candidate.sources),
        time: D.now(),
        actor: m.id,
        candidate: doc.candidate.id,
        request: {
          workspace: w.id,
          document: doc.id,
          sourceSnapshot: evidence.sources,
          contentSnapshot: structuredClone(doc.candidate.content),
          clarifications: evidence.clarifications,
          rewriteSources: evidence.rewriteSources,
          priorRewriteSources: evidence.priorRewriteSources,
          rewriteSourceIds: evidence.rewriteSourceIds,
          supersededSourceIds: evidence.supersededSourceIds,
          template: doc.template,
          templateVersion: "office-v1",
          workingRevision: doc.candidate.revision,
          candidate: doc.candidate.id,
          consent: { actor: m.id, time: D.now(), provider: "Sarvam" },
          promptVersion: AI_PROMPT_VERSION,
          model: process.env.SARVAM_CHAT_MODEL || "sarvam-105b",
        },
        section: section || null,
      };
      doc.proposals.push(p);
      s.generationUsage.push({ member: m.id, job: p.id, time: D.now() });
      D.event(s, m, "Requested AI proposal", doc.id, {
        proposal: p.id,
        revision: p.revision,
      });
      return {
        ...p,
        input: {
          ...evidence,
          title: doc.title,
          content: doc.candidate.content,
          section,
        },
      };
    });
    res.status(202).json({ job: p.id });
    if (p.existing) return;
    const controller = new AbortController();
    generationControllers.set(p.id, {
      controller,
      workspace: req.params.wid,
      document: req.params.docId,
    });
    Promise.resolve()
      .then(() => ai(p.input, { signal: controller.signal }))
      .then((output) =>
        store.transaction(req.params.wid, (w, s) => {
          if (!w || w.deletion) return;
          const m = store
            .members(w.id)
            .find((x) => x.id === p.actor && x.active);
          const doc = s.documents.find((x) => x.id === req.params.docId);
          const job = doc?.proposals.find((x) => x.id === p.id);
          if (!job || job.status !== "Generating") return;
          if (
            !m ||
            !D.canEdit(m, doc) ||
            !doc.candidate ||
            doc.candidate.id !== job.candidate ||
            !["Draft", "Changes requested"].includes(doc.candidate.status)
          ) {
            job.status = "Cancelled";
            return;
          }
          validateGeneratedProposal(output, job.request.sourceSnapshot, {
            section: job.section,
            content: job.request.contentSnapshot,
            clarifications: job.request.clarifications || [],
            rewriteSources: job.request.rewriteSources || [],
            priorRewriteSources: job.request.priorRewriteSources || [],
            rewriteSourceIds: job.request.rewriteSourceIds || [],
            supersededSourceIds: job.request.supersededSourceIds || [],
          });
          job.output = output;
          job.status = "Ready";
          job.completed = D.now();
          D.event(s, m, "Generated proposal", doc.id, { revision: p.revision });
        }),
      )
      .catch((error) => {
        try {
          store.transaction(req.params.wid, (w, s) => {
            const job = s?.documents
              .find((x) => x.id === req.params.docId)
              ?.proposals.find((x) => x.id === p.id);
            if (job?.status === "Generating") {
              job.status = "Failed";
              job.error = `${error.status ? error.message : "Generation could not finish."} Your saved draft is unchanged. Retry or continue manually.`;
              job.errorCategory =
                error.status === 502
                  ? "invalid-output-or-provider"
                  : "provider-error";
              job.completed = D.now();
              const member = store
                .members(req.params.wid)
                .find((member) => member.id === job.actor);
              if (member)
                D.event(s, member, "AI generation failed", req.params.docId, {
                  proposal: job.id,
                  outcome: "failure",
                  category: job.errorCategory,
                });
            }
          });
        } catch {}
      })
      .finally(() => generationControllers.delete(p.id));
  });
  app.post("/api/w/:wid/notifications/read", (req, res) => {
    mutate(req, (w, s, m) => {
      for (const n of s.notifications.filter(
        (x) => x.member === m.id && (!req.body.id || x.id === req.body.id),
      ))
        n.read = true;
    });
    res.json({ ok: true });
  });
  app.get("/api/w/:wid/invites", (req, res) => {
    D.need(D.admin(req.member), "Only administrators manage invitations.", 403);
    res.json(
      store.all(
        "SELECT id,email,role,expires,revoked,accepted FROM invites WHERE workspace=?",
        req.params.wid,
      ),
    );
  });
  app.post("/api/w/:wid/invites", async (req, res, next) => {
    if (review)
      return res.status(403).json({
        error:
          "Email invitations are disabled in this review build. Use Switch demo role to try reviewer and reader access.",
      });
    try {
      D.need(D.admin(req.member), "Only administrators invite members.", 403);
      const email = String(req.body.email || "")
        .toLowerCase()
        .trim();
      D.need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Enter a valid email.");
      const role = req.body.role;
      D.need(
        ["Author", "Reader", "Admin"].includes(role),
        "Choose a valid role.",
      );
      D.need(
        role !== "Admin" || req.member.role === "Owner",
        "Only the owner appoints administrators.",
        403,
      );
      D.need(
        !store
          .members(req.params.wid)
          .some((m) => m.email === email && m.active),
        "This person is already a member.",
      );
      D.need(!prod || mailer, "Email delivery is not configured.", 503);
      const raw = randomBytes(32).toString("hex");
      const iid = D.id();
      store.run(
        "INSERT INTO invites(id,workspace,email,role,token,expires) VALUES(?,?,?,?,?,?)",
        iid,
        req.params.wid,
        email,
        role,
        digest(raw),
        new Date(Date.now() + 7 * 86400000).toISOString(),
      );
      const link = `${url}/?invite=${raw}`;
      await mail(email, `Join ${req.workspace.name} on SOPEasy`, link);
      mutate(req, (w, s, m) => D.event(s, m, "Invited teammate", iid));
      res.json({ ok: true, ...(!prod ? { developmentLink: link } : {}) });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/w/:wid/invites/:iid/revoke", (req, res) => {
    D.need(D.admin(req.member), "Only administrators manage invitations.", 403);
    const i = store.get(
      "SELECT * FROM invites WHERE id=? AND workspace=?",
      req.params.iid,
      req.params.wid,
    );
    D.need(i, "Invitation not found.", 404);
    D.need(
      i.role !== "Admin" || req.member.role === "Owner",
      "Only the owner manages admin invitations.",
      403,
    );
    store.run("UPDATE invites SET revoked=1 WHERE id=?", i.id);
    mutate(req, (w, s, m) => D.event(s, m, "Revoked invitation", i.id));
    res.json({ ok: true });
  });
  app.post("/api/w/:wid/members/:mid", (req, res) => {
    mutate(req, (w, s, m, members) => {
      D.need(D.admin(m), "Only administrators manage members.", 403);
      const target = members.find((x) => x.id === req.params.mid);
      D.need(target, "Member not found.");
      D.need(
        target.role !== "Owner",
        "Transfer workspace ownership before changing the owner.",
      );
      D.need(
        (target.role !== "Admin" && req.body.role !== "Admin") ||
          m.role === "Owner",
        "Only the owner manages administrators.",
        403,
      );
      const role = req.body.role || target.role;
      D.need(
        ["Admin", "Author", "Reader"].includes(role),
        "Choose a valid role.",
      );
      const active =
        req.body.active === undefined ? target.active : !!req.body.active;
      store.run(
        "UPDATE memberships SET role=?,active=? WHERE id=?",
        role,
        active ? 1 : 0,
        target.id,
      );
      for (const doc of s.documents)
        for (const job of doc.proposals.filter(
          (job) =>
            job.actor === target.id &&
            ["Queued", "Generating"].includes(job.status),
        ))
          if (!active || !D.canEdit({ ...target, role }, doc))
            job.status = "Cancelled";
      if (!active || !D.author({ role })) {
        for (const doc of s.documents) {
          for (const job of doc.proposals.filter(
            (job) =>
              job.actor === target.id &&
              ["Queued", "Generating"].includes(job.status),
          ))
            job.status = "Cancelled";
          if (doc.candidate?.reviewer === target.id) {
            doc.candidate.status = "Draft";
            doc.candidate.approval = null;
            doc.candidate.reviewer = null;
            doc.candidate.submission = null;
          }
        }
      }
      if (!active) {
        store.run("DELETE FROM sessions WHERE user=?", target.user);
        store.run(
          "UPDATE invites SET revoked=1 WHERE workspace=? AND email=?",
          w.id,
          target.email,
        );
        for (const a of s.assignments.filter(
          (x) => x.member === target.id && x.status === "Pending",
        ))
          a.status = "Cancelled";
      }
      D.event(
        s,
        m,
        active ? "Updated member role" : "Deactivated member",
        target.id,
      );
    });
    abortCancelledJobs(req.params.wid);
    res.json({ ok: true });
  });
  app.post("/api/w/:wid/settings", (req, res) => {
    mutate(req, (w, s, m, members) => {
      D.need(D.admin(m), "Only administrators change workspace settings.", 403);
      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        D.need(
          name && name.length <= 100,
          "Choose a workspace name of up to 100 characters.",
        );
        w.name = name;
      }
      if (req.body.timezone) {
        try {
          new Intl.DateTimeFormat("en", { timeZone: req.body.timezone });
        } catch {
          throw new D.Problem("Invalid timezone.");
        }
        w.timezone = req.body.timezone;
      }
      if (req.body.logo !== undefined) {
        const logo = req.body.logo;
        if (logo) {
          D.need(
            /^data:image\/(png|jpeg);base64,/.test(logo) &&
              logo.length < 2800000,
            "Upload a PNG or JPEG logo up to 2 MB.",
          );
          const bytes = Buffer.from(logo.split(",")[1], "base64");
          D.need(
            bytes.length <= 2097152 &&
              ((bytes[0] === 137 &&
                bytes[1] === 80 &&
                bytes[2] === 78 &&
                bytes[3] === 71) ||
                (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)),
            "The logo is not a valid PNG or JPEG.",
          );
          try {
            if (logo.startsWith("data:image/png;")) validatePng(bytes);
            const probe = new PDFDocument();
            const image = probe.openImage(bytes);
            D.need(
              image.width > 0 &&
                image.height > 0 &&
                image.width <= 4096 &&
                image.height <= 4096,
              "Use a logo no larger than 4096 × 4096 pixels.",
            );
            D.need(
              (logo.startsWith("data:image/png;") && bytes[0] === 137) ||
                (logo.startsWith("data:image/jpeg;") && bytes[0] === 255),
              "The logo type does not match its contents.",
            );
          } catch (error) {
            if (error.status) throw error;
            throw new D.Problem("The logo is not a valid PNG or JPEG.");
          }
        }
        w.logo = logo || null;
      }
      if (req.body.owner) {
        D.need(
          m.role === "Owner",
          "Only the owner can transfer ownership.",
          403,
        );
        const target = members.find((x) => x.id === req.body.owner && x.active);
        D.need(target, "Choose an active member.");
        store.run("UPDATE memberships SET role=? WHERE id=?", "Admin", m.id);
        store.run(
          "UPDATE memberships SET role=? WHERE id=?",
          "Owner",
          target.id,
        );
        w.owner = target.user;
      }
      D.event(s, m, "Updated workspace settings", w.id);
    });
    res.json({ ok: true });
  });
  app.get("/api/w/:wid/export.json", (req, res) => {
    D.need(
      D.admin(req.member),
      "Only administrators export workspace data.",
      403,
    );
    mutate(req, (w, s, m) => D.event(s, m, "Exported workspace data", w.id));
    const w = req.workspace;
    res.set(
      "Content-Disposition",
      'attachment; filename="sopeasy-workspace.json"',
    );
    res.json({
      format: "sopeasy-workspace-v1",
      exported: D.now(),
      workspace: { name: w.name, timezone: w.timezone },
      members: store.members(w.id).map(({ id, name, email, role, active }) => ({
        id,
        name,
        email,
        role,
        active,
      })),
      ...w.state,
    });
  });
  app.get("/api/w/:wid/reports.csv", (req, res) => {
    D.need(D.author(req.member), "Your role cannot export team reports.", 403);
    const s = req.workspace.state;
    const rows = [
      [
        "Procedure",
        "Version",
        "Recipient",
        "Status",
        "Deadline",
        "Acknowledged at",
      ],
    ];
    for (const a of s.assignments) {
      const doc = s.documents.find((x) => x.id === a.doc);
      if (!doc || (!D.admin(req.member) && doc.owner !== req.member.id))
        continue;
      const member = store
        .members(req.params.wid)
        .find((x) => x.id === a.member);
      rows.push([
        doc.title,
        a.version,
        member?.name || "Inactive member",
        a.status === "Pending" && a.deadline < D.now() ? "Overdue" : a.status,
        a.deadline,
        a.receipt?.time || "",
      ]);
    }
    const escape = (x) =>
      '"' +
      String(x)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    mutate(req, (w, s, m) =>
      D.event(s, m, "Exported acknowledgement report", w.id),
    );
    res
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="sopeasy-acknowledgements.csv"',
      })
      .send(rows.map((r) => r.map(escape).join(",")).join("\r\n"));
  });
  app.post("/api/w/:wid/delete", (req, res) => {
    mutate(req, (w, s, m) => {
      D.need(m.role === "Owner", "Only the owner can request deletion.", 403);
      D.need(
        req.body.confirmation === w.name,
        "Type the exact workspace name.",
      );
      w.deletion = new Date(Date.now() + 7 * 86400000).toISOString();
      for (const doc of s.documents)
        for (const job of doc.proposals.filter((job) =>
          ["Queued", "Generating"].includes(job.status),
        ))
          job.status = "Cancelled";
      D.event(s, m, "Requested workspace deletion", w.id);
    });
    abortCancelledJobs(req.params.wid);
    res.json({ ok: true });
  });
  app.post("/api/w/:wid/recovery", (req, res) => {
    D.need(
      req.member.role === "Owner",
      "Only the owner can cancel deletion.",
      403,
    );
    store.transaction(req.params.wid, (w, s) => {
      D.need(
        w.deletion && w.deletion > D.now(),
        "This workspace is not recoverable.",
      );
      w.deletion = null;
      D.event(s, req.member, "Cancelled deletion", w.id);
    });
    res.json({ ok: true });
  });
  app.get("/api/w/:wid/docs/:docId/pdf", (req, res) => {
    const doc = D.findDoc(req.workspace.state, req.params.docId);
    D.docView(doc, req.member);
    const draft = req.query.draft === "1";
    let v;
    if (draft) {
      D.need(
        D.canDraft(req.member, doc) && doc.candidate,
        "You cannot export this draft.",
        403,
      );
      v = {
        title: doc.title,
        content: doc.candidate.content,
        published: null,
        number: "Draft",
      };
    } else {
      v = doc.versions.find(
        (x) => x.number === Number(req.query.version || doc.current),
      );
      D.need(v, "Published version not found.", 404);
      D.need(
        v.number === doc.current || D.canEdit(req.member, doc),
        "Historical export is unavailable.",
        403,
      );
    }
    D.need(
      draft || !doc.archived || D.canEdit(req.member, doc),
      "Archived procedures cannot be downloaded.",
      403,
    );
    const pdf = new PDFDocument({
      size: "A4",
      margins: { top: 54, left: 54, right: 54, bottom: 94 },
      bufferPages: true,
    });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="procedure-${doc.id.slice(0, 8)}-${v.number}.pdf"`,
    });
    const pdfChunks = [];
    pdf.on("data", (chunk) => pdfChunks.push(chunk));
    pdf.on("end", () => res.send(Buffer.concat(pdfChunks)));
    pdf.on("error", () => {
      if (!res.headersSent) res.status(500).end();
    });
    if (req.workspace.logo) {
      pdf.image(
        Buffer.from(req.workspace.logo.split(",")[1], "base64"),
        54,
        54,
        { fit: [32, 32] },
      );
      pdf.x = 98;
    }
    pdf
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#56644b")
      .text(req.workspace.name);
    pdf.moveDown();
    pdf.font("Times-Roman").fontSize(30).fillColor("#222820").text(v.title);
    pdf.moveDown(0.4);
    pdf
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#646b5d")
      .text(
        `Version ${v.number} | ${v.published ? new Date(v.published).toLocaleDateString("en-GB") : "Unpublished"} | Owner: ${store.members(req.params.wid).find((x) => x.id === doc.owner)?.name || "Reassignment required"}`,
      );
    pdf.moveDown(1.5);
    const bodyFont = () =>
      pdf.font("Helvetica").fontSize(10.5).fillColor("#34382f");
    const table = (rows) => {
      const left = 54,
        width = pdf.page.width - 108;
      const columns = Math.max(...rows.map((row) => row.length));
      const cellWidth = width / columns,
        lineHeight = 14,
        padding = 7;
      const wrap = (text) => {
        const lines = [];
        for (const paragraph of String(text || "").split("\n")) {
          let line = "";
          for (const word of paragraph.split(/\s+/)) {
            if (
              pdf.widthOfString(line ? `${line} ${word}` : word) <=
              cellWidth - 2 * padding
            ) {
              line = line ? `${line} ${word}` : word;
              continue;
            }
            if (line) {
              lines.push(line);
              line = "";
            }
            let fragment = "";
            for (const char of word) {
              if (
                fragment &&
                pdf.widthOfString(fragment + char) > cellWidth - 2 * padding
              ) {
                lines.push(fragment);
                fragment = "";
              }
              fragment += char;
            }
            line = fragment;
          }
          lines.push(line);
        }
        return lines;
      };
      const draw = (lines, offset, count, header = false) => {
        const y = pdf.y,
          height = count * lineHeight + padding * 2;
        for (let col = 0; col < columns; col++) {
          const x = left + col * cellWidth;
          pdf
            .save()
            .rect(x, y, cellWidth, height)
            .fillAndStroke(header ? "#e7ecdf" : "#fffefb", "#d8dfd1")
            .restore();
          pdf
            .font(header ? "Helvetica-Bold" : "Helvetica")
            .fontSize(10.5)
            .fillColor("#34382f");
          lines[col]?.slice(offset, offset + count).forEach((line, i) =>
            pdf.text(line, x + padding, y + padding + i * lineHeight, {
              lineBreak: false,
            }),
          );
        }
        pdf.x = left;
        pdf.y = y + height;
      };
      pdf.font("Helvetica-Bold").fontSize(10.5);
      const header = rows[0].map(wrap),
        headerLines = Math.max(...header.map((cell) => cell.length));
      const headerHeight = headerLines * lineHeight + padding * 2;
      if (headerHeight > pdf.page.contentHeight / 2) {
        bodyFont().text(rows.map((row) => row.join(" | ")).join("\n"), {
          lineGap: 4,
        });
        return;
      }
      const newPage = () => {
        pdf.addPage();
        draw(header, 0, headerLines, true);
      };
      if (pdf.y + headerHeight + 2 * lineHeight + padding * 2 > pdf.page.maxY())
        pdf.addPage();
      draw(header, 0, headerLines, true);
      for (const row of rows.slice(1)) {
        bodyFont();
        const lines = row.map(wrap),
          maxLines = Math.max(...lines.map((cell) => cell.length));
        let offset = 0;
        while (offset < maxLines) {
          const available = Math.floor(
            (pdf.page.maxY() - pdf.y - padding * 2) / lineHeight,
          );
          if (available < 1) {
            newPage();
            continue;
          }
          if (
            offset === 0 &&
            maxLines > available &&
            maxLines * lineHeight + padding * 2 <=
              pdf.page.contentHeight - headerHeight
          ) {
            newPage();
            continue;
          }
          const count = Math.min(maxLines - offset, available);
          draw(lines, offset, count);
          offset += count;
          if (offset < maxLines) newPage();
        }
      }
      pdf.moveDown(0.8);
    };
    const body = (text) => {
      const lines = String(text).split("\n");
      let paragraph = [];
      const flush = () => {
        if (!paragraph.length) return;
        bodyFont().text(paragraph.join("\n"), { lineGap: 4 });
        paragraph = [];
      };
      for (let i = 0; i < lines.length; i++) {
        if (
          /^\s*\|.*\|\s*$/.test(lines[i]) &&
          /^\s*\|[\s:|\-]+\|\s*$/.test(lines[i + 1] || "")
        ) {
          flush();
          const cells = (line) =>
            line
              .trim()
              .slice(1, -1)
              .split("|")
              .map((cell) => cell.trim());
          const rows = [cells(lines[i])];
          i += 2;
          while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]))
            rows.push(cells(lines[i++]));
          i--;
          table(rows);
        } else paragraph.push(lines[i]);
      }
      flush();
    };
    const section = (title, text) => {
      if (!text) return;
      pdf.font("Helvetica-Bold").fontSize(13);
      if (pdf.y + pdf.heightOfString(title) + 42 > pdf.page.maxY())
        pdf.addPage();
      pdf.font("Helvetica-Bold").fontSize(13).fillColor("#242820").text(title);
      pdf.moveDown(0.4);
      body(text);
      pdf.moveDown(1);
    };
    section("Purpose", v.content.purpose);
    section("Scope", v.content.scope);
    section("Responsibilities", v.content.responsibilities);
    section("Prerequisites", v.content.prerequisites);
    v.content.steps.forEach((step, i) =>
      section(
        `${i + 1}. ${step.title}${step.responsible ? " · " + step.responsible : ""}`,
        step.body,
      ),
    );
    section("Exceptions", v.content.exceptions);
    section("Completion checks", v.content.completion);
    section("Checklist", v.content.checklist.map((x) => "[ ] " + x).join("\n"));
    const range = pdf.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      pdf.switchToPage(i);
      const previous = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#73796c")
        .text(
          `${draft ? "DRAFT · " : ""}Version ${v.number} · Page ${i + 1} of ${range.count}`,
          54,
          780,
          { lineBreak: false },
        );
      pdf.text(
        "Check the online library for the current version (sign-in required).",
        54,
        793,
        { lineBreak: false },
      );
      pdf.link(
        54,
        793,
        260,
        12,
        `${url}/?workspace=${req.params.wid}&document=${doc.id}`,
      );
      pdf.page.margins.bottom = previous;
    }
    pdf.end();
    mutate(req, (w, s, m) =>
      D.event(s, m, "Exported PDF", doc.id, { version: v.number }),
    );
  });
  app.use((err, req, res, next) => {
    if (config.onError) config.onError(err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
      error: err.status
        ? err.message
        : "The request could not finish. Please retry.",
    });
  });
  return app;
}

export function maintenance(store) {
  reviewSandboxes.get(store)?.cleanup();
  const executions = runningGenerations.get(store);
  store.run("DELETE FROM sessions WHERE expires<?", D.now());
  store.run("DELETE FROM tokens WHERE expires<?", D.now());
  store.run(
    "DELETE FROM outbox WHERE created<?",
    new Date(Date.now() - 30 * 86400000).toISOString(),
  );
  for (const row of store.all("SELECT id,deletion FROM workspaces")) {
    if (row.deletion && row.deletion < D.now()) {
      for (const execution of executions?.values() || [])
        if (execution.workspace === row.id)
          execution.controller.abort(
            new DOMException("Workspace was deleted", "AbortError"),
          );
      store.run("DELETE FROM workspaces WHERE id=?", row.id);
      store.run(
        "INSERT INTO lifecycle_events VALUES(?,?,?,?)",
        D.id(),
        row.id,
        "Workspace purge completed",
        D.now(),
      );
      continue;
    }
    store.transaction(row.id, (w, s) => {
      if (w.deletion) return;
      s.generationUsage = s.generationUsage.filter(
        (x) => Date.parse(x.time) > Date.now() - 86400000,
      );
      const members = store.members(w.id);
      for (const a of s.assignments.filter((a) => a.status === "Pending")) {
        const doc = s.documents.find((d) => d.id === a.doc);
        if (!doc || doc.archived) continue;
        const remaining = Date.parse(a.deadline) - Date.now();
        if (remaining < 0)
          D.notify(
            s,
            members,
            [a.member],
            "Reading is overdue",
            doc.title,
            doc.id,
            `overdue-${a.id}-${a.deadline}`,
          );
        else if (remaining < 86400000)
          D.notify(
            s,
            members,
            [a.member],
            "Reading is due soon",
            doc.title,
            doc.id,
            `due-${a.id}-${a.deadline}`,
          );
      }
      for (const doc of s.documents) {
        for (const job of doc.proposals.filter((job) =>
          ["Queued", "Generating"].includes(job.status),
        )) {
          if (Date.parse(job.time) < Date.now() - 5 * 60000) {
            job.status = "Failed";
            job.errorCategory = "timeout";
            job.error =
              "Generation timed out. Your saved draft is unchanged. Retry or continue manually.";
            executions
              ?.get(job.id)
              ?.controller.abort(
                new DOMException("Generation timed out", "AbortError"),
              );
          }
        }
        doc.proposals = doc.proposals.filter(
          (p) =>
            !["Cancelled", "Failed"].includes(p.status) ||
            Date.parse(p.time) > Date.now() - 30 * 86400000,
        );
        if (doc.current && !doc.archived && doc.reviewDue < D.now())
          D.notify(
            s,
            members,
            [doc.owner],
            "A procedure is due for review",
            doc.title,
            doc.id,
            `reviewdue-${doc.id}-${doc.reviewDue}`,
          );
      }
    });
  }
}
