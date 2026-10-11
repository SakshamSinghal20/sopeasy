import { randomBytes } from "node:crypto";
import { digest, seed } from "./db.mjs";

const lifetime = 3 * 86400000;
// Separate sample workspaces per browser. The capability stays in an HttpOnly
// cookie; switching a sample role never grants access to another visitor.
export function reviewAccess(store, secure) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS review_visits(
    token TEXT PRIMARY KEY, workspace TEXT NOT NULL, people TEXT NOT NULL,
    expires TEXT NOT NULL)`);
  function lookup(req) {
    const row = store.get(
      "SELECT * FROM review_visits WHERE token=? AND expires>?",
      digest(req.cookies.sopeasy_review || ""),
      new Date().toISOString(),
    );
    return row && store.read(row.workspace)
      ? { ...row, people: JSON.parse(row.people) }
      : null;
  }
  function remove(row) {
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.run("DELETE FROM workspaces WHERE id=?", row.workspace);
      for (const person of JSON.parse(row.people)) {
        store.run("DELETE FROM sessions WHERE user=?", person.id);
        store.run("DELETE FROM tokens WHERE user=?", person.id);
        store.run("DELETE FROM users WHERE id=?", person.id);
      }
      store.run("DELETE FROM review_visits WHERE token=?", row.token);
      store.db.exec("COMMIT");
    } catch (error) {
      store.db.exec("ROLLBACK");
      throw error;
    }
  }
  function cleanup() {
    for (const row of store.all(
      "SELECT * FROM review_visits WHERE expires<=?",
      new Date().toISOString(),
    ))
      remove(row);
  }
  function open(req, res) {
    let visit = lookup(req);
    if (visit) return visit;
    cleanup();
    if (store.get("SELECT COUNT(*) AS count FROM review_visits").count >= 100) {
      const error = new Error(
        "The review sandbox is full. Please try again later.",
      );
      error.status = 429;
      throw error;
    }
    const raw = randomBytes(32).toString("hex");
    visit = seed(store, randomBytes(16).toString("hex"));
    store.run(
      "INSERT INTO review_visits VALUES(?,?,?,?)",
      digest(raw),
      visit.workspace,
      JSON.stringify(visit.people),
      new Date(Date.now() + lifetime).toISOString(),
    );
    res.cookie("sopeasy_review", raw, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: lifetime,
      path: "/",
    });
    return visit;
  }
  return {
    lookup,
    open,
    cleanup,
    reset(req, res) {
      const visit = lookup(req);
      if (visit) remove({ ...visit, people: JSON.stringify(visit.people) });
      res.clearCookie("sopeasy_review", {
        path: "/",
        secure,
        httpOnly: true,
        sameSite: "lax",
      });
    },
  };
}
