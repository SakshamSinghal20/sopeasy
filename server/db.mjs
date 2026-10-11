import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import {
  id,
  now,
  initialState,
  createDoc,
  emptyContent,
  event,
} from "./domain.mjs";

export const digest = (token) =>
  createHash("sha256").update(token).digest("hex");
export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordValid(password, stored) {
  try {
    const [salt, key] = stored.split(":");
    return timingSafeEqual(
      Buffer.from(key, "hex"),
      scryptSync(password, salt, 64),
    );
  } catch {
    return false;
  }
}
export function database(path) {
  if (path !== ":memory:") mkdirSync(join(path, ".."), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT NOT NULL REFERENCES users(id),expires TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY,user TEXT REFERENCES users(id),kind TEXT NOT NULL,expires TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,timezone TEXT NOT NULL,owner TEXT NOT NULL REFERENCES users(id),logo TEXT,state TEXT NOT NULL,deletion TEXT);
    CREATE TABLE IF NOT EXISTS memberships(id TEXT PRIMARY KEY,workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,user TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,UNIQUE(workspace,user));
    CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,email TEXT NOT NULL,role TEXT NOT NULL,token TEXT UNIQUE NOT NULL,expires TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,accepted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,email TEXT NOT NULL,subject TEXT NOT NULL,url TEXT NOT NULL,created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS membership_user ON memberships(user,workspace);
    CREATE TABLE IF NOT EXISTS lifecycle_events(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,action TEXT NOT NULL,time TEXT NOT NULL);
  `);
  return {
    db,
    get(sql, ...args) {
      return db.prepare(sql).get(...args);
    },
    all(sql, ...args) {
      return db.prepare(sql).all(...args);
    },
    run(sql, ...args) {
      return db.prepare(sql).run(...args);
    },
    members(wid) {
      return db
        .prepare(
          "SELECT m.*,u.name,u.email FROM memberships m JOIN users u ON m.user=u.id WHERE workspace=?",
        )
        .all(wid)
        .map((m) => ({ ...m, active: !!m.active }));
    },
    read(wid) {
      const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(wid);
      return w ? { ...w, state: JSON.parse(w.state) } : null;
    },
    transaction(wid, fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const w = this.read(wid);
        const result = fn(w, w?.state);
        if (w) for (const entry of w.state.audit) entry.workspace ??= wid;
        if (w)
          db.prepare(
            "UPDATE workspaces SET state=?,name=?,timezone=?,logo=?,deletion=?,owner=? WHERE id=?",
          ).run(
            JSON.stringify(w.state),
            w.name,
            w.timezone,
            w.logo || null,
            w.deletion || null,
            w.owner,
            wid,
          );
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    createWorkspace(user, name, timezone = "Asia/Calcutta") {
      const wid = id(),
        mid = id();
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(
          "INSERT INTO workspaces(id,name,timezone,owner,state) VALUES(?,?,?,?,?)",
        ).run(wid, name, timezone, user.id, JSON.stringify(initialState()));
        db.prepare(
          "INSERT INTO memberships(id,workspace,user,role) VALUES(?,?,?,?)",
        ).run(mid, wid, user.id, "Owner");
        db.exec("COMMIT");
        return wid;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close() {
      db.close();
    },
  };
}
export function seed(store, namespace = "") {
  if (
    !namespace &&
    store.get("SELECT id FROM users WHERE email=?", "maya@sopeasy.example")
  )
    return;
  const people = [
    ["Maya Kapoor", "maya@sopeasy.example", "Owner"],
    ["Arjun Mehta", "arjun@sopeasy.example", "Author"],
    ["Leena Rao", "leena@sopeasy.example", "Reader"],
  ].map(([name, email, role]) => ({
    id: id(),
    name,
    email: namespace ? email.replace("@", `+${namespace}@`) : email,
    role,
  }));
  for (const p of people)
    store.run(
      "INSERT INTO users VALUES(?,?,?,?,1)",
      p.id,
      p.name,
      p.email,
      passwordHash(
        namespace ? randomBytes(32).toString("hex") : "Sopeasy-demo-2026!",
      ),
    );
  const wid = store.createWorkspace(people[0], "Northstar Studio");
  for (const p of people.slice(1))
    store.run(
      "INSERT INTO memberships(id,workspace,user,role) VALUES(?,?,?,?)",
      id(),
      wid,
      p.id,
      p.role,
    );
  const members = store.members(wid);
  const owner = members.find((m) => m.role === "Owner"),
    reviewer = members.find((m) => m.role === "Author"),
    reader = members.find((m) => m.role === "Reader");
  store.transaction(wid, (w, s) => {
    const examples = [
      ["Employee onboarding", "People & culture", "onboarding"],
      ["Equipment request", "Operations", "equipment"],
      ["Leave and time off", "People & culture", "leave"],
      ["Client project handover", "Client services", "general"],
      ["Office opening checklist", "Operations", "general"],
      ["Expense reimbursement", "Finance", "general"],
      ["New software access", "IT & systems", "equipment"],
      ["Remote work setup", "People & culture", "general"],
      ["Visitor welcome", "Operations", "general"],
      ["Weekly team check-in", "People & culture", "general"],
    ];
    examples.forEach(([title, category, template], i) => {
      const doc = createDoc(s, owner, {
        title,
        category,
        template,
        sources: `The ${category.toLowerCase()} lead coordinates ${title.toLowerCase()}.\nThe requester supplies the relevant details to the process owner.\nThe process owner checks the request and records the agreed outcome.\nThe team confirms completion with the requester.`,
      });
      doc.demo = true;
      const content = {
        ...emptyContent(),
        purpose: `Help the team handle ${title.toLowerCase()} consistently, with a clear owner and a recorded outcome.`,
        scope:
          "Applies to the Northstar Studio demonstration workspace. Confirm the details with your process owner before adopting this example.",
        responsibilities:
          "Process owner: coordinate and record the outcome.\nRequester: provide accurate information and confirm completion.",
        prerequisites:
          "A complete request and the information the process owner needs.",
        steps: [
          {
            id: id(),
            title: "Capture the request",
            body: "The requester shares the relevant details with the process owner. Keep the information together so the team can review it.",
            responsible: "Requester",
          },
          {
            id: id(),
            title: "Review the details",
            body: "The process owner checks the request. Ask the requester to clarify any missing information before proceeding.",
            responsible: "Process owner",
          },
          {
            id: id(),
            title: "Coordinate the work",
            body: "The process owner coordinates the agreed next steps and records the outcome.",
            responsible: "Process owner",
          },
          {
            id: id(),
            title: "Confirm completion",
            body: "Check the result with the requester and record that the procedure is complete.",
            responsible: "Process owner",
          },
        ],
        exceptions:
          "If information is missing, return to the requester for clarification.",
        completion:
          "The requester confirms the outcome and the owner records completion.",
        checklist: [
          "Request details recorded",
          "Outcome confirmed with the requester",
        ],
      };
      doc.candidate.content = content;
      if (i < 7) {
        const approval = {
          id: id(),
          name: reviewer.name,
          reviewer: reviewer.id,
          time: now(),
        };
        doc.versions = [
          {
            id: id(),
            number: 1,
            title,
            content,
            sources: doc.candidate.sources,
            published: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
            publisher: owner.name,
            approval,
            summary: "Initial demonstration version",
            key: id(),
          },
        ];
        doc.current = 1;
        doc.candidate = null;
        doc.reviewDue = new Date(
          Date.now() + (i === 5 ? -2 : 30 + i * 5) * 86400000,
        ).toISOString();
        s.assignments.push({
          id: id(),
          doc: doc.id,
          version: 1,
          member: reader.id,
          deadline: new Date(
            Date.now() + (i === 2 ? -1 : 5) * 86400000,
          ).toISOString(),
          status: i < 2 ? "Acknowledged" : "Pending",
          receipt:
            i < 2
              ? {
                  id: id(),
                  version: 1,
                  member: reader.id,
                  time: now(),
                  text: "I have read and understood this version.",
                }
              : null,
          created: now(),
        });
      } else if (i === 7) {
        doc.candidate.status = "In review";
        doc.candidate.reviewer = reviewer.id;
        doc.candidate.submission = {
          id: id(),
          revision: 1,
          content: structuredClone(content),
          title,
          sources: doc.candidate.sources,
          gaps: [],
          time: now(),
          hash: createHash("sha256")
            .update(JSON.stringify({ title, content }))
            .digest("hex"),
        };
      } else if (i === 8) {
        doc.candidate.status = "Changes requested";
        doc.candidate.feedback =
          "Please clarify how we confirm a visitor’s host before proceeding.";
      }
    });
    event(s, owner, "Opened demonstration workspace", wid);
  });
  return { workspace: wid, people };
}
