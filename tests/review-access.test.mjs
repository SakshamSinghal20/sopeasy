import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";

async function fixture(t, review) {
  const store = database(":memory:");
  const server = createApp(store, {
    production: true,
    review,
    url: "https://review.example.test",
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  function browser() {
    const cookies = new Map();
    return async (path, body, origin = "https://review.example.test") => {
      const res = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          Origin: origin,
          "Content-Type": "application/json",
          "x-sopeasy-request": "1",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of res.headers.getSetCookie()) {
        const [key, value] = cookie.split(";")[0].split("=");
        cookies.set(key, value);
      }
      return {
        status: res.status,
        body: await res.json(),
        cookies: res.headers.getSetCookie(),
      };
    };
  }
  return { store, browser };
}

test("review access opens isolated sample workspaces, enforces roles, and resets only its own visitor", async (t) => {
  const f = await fixture(t, true),
    a = f.browser(),
    b = f.browser();
  assert.equal((await a("/api/bootstrap")).status, 401);
  const opened = await a("/api/auth/review", {});
  assert.equal(opened.status, 200);
  assert.ok(
    opened.cookies.every(
      (c) =>
        c.includes("HttpOnly") &&
        c.includes("Secure") &&
        c.includes("SameSite=Lax"),
    ),
  );
  const first = (await a("/api/bootstrap")).body;
  assert.equal(first.workspace.member.role, "Owner");
  assert.equal(first.config.review, true);
  assert.equal(first.documents.length, 10);
  const sampleAuthor = f.store
    .members(first.workspace.id)
    .find((m) => m.role === "Author");
  f.store.run("UPDATE memberships SET active=0 WHERE id=?", sampleAuthor.id);
  assert.equal(
    (await a("/api/auth/demo", { email: "arjun@sopeasy.example" })).status,
    403,
  );
  assert.equal((await a("/api/bootstrap")).body.workspace.member.role, "Owner");
  f.store.run("UPDATE memberships SET active=1 WHERE id=?", sampleAuthor.id);
  assert.equal(
    (await a("/api/auth/register", { email: "real@example.test" })).status,
    403,
  );
  assert.equal((await a("/api/workspaces", { name: "Real team" })).status, 403);
  assert.equal(
    (
      await a(`/api/w/${first.workspace.id}/invites`, {
        email: "real@example.test",
      })
    ).status,
    403,
  );
  await b("/api/auth/review", {});
  const second = (await b("/api/bootstrap")).body;
  assert.notEqual(first.workspace.id, second.workspace.id);
  assert.equal(
    (await b(`/api/w/${first.workspace.id}/docs/${first.documents[0].id}`))
      .status,
    403,
  );
  assert.equal(
    (await a("/api/auth/demo", { email: "leena@sopeasy.example" })).status,
    200,
  );
  assert.equal(
    (await a("/api/bootstrap")).body.workspace.member.role,
    "Reader",
  );
  assert.equal(
    (await a(`/api/w/${first.workspace.id}/docs`, { title: "Forbidden" }))
      .status,
    403,
  );
  assert.equal(
    (await a("/api/auth/demo", { email: "arjun@sopeasy.example" })).status,
    200,
  );
  assert.equal(
    (await a("/api/bootstrap")).body.workspace.member.role,
    "Author",
  );
  assert.equal(
    (await a("/api/auth/review-reset", {}, "https://attacker.test")).status,
    403,
  );
  assert.equal((await a("/api/auth/review-reset", {})).status, 200);
  assert.equal(f.store.read(first.workspace.id), null);
  assert.equal(
    (await b("/api/bootstrap")).body.workspace.id,
    second.workspace.id,
  );
  await a("/api/auth/review", {});
  assert.notEqual(
    (await a("/api/bootstrap")).body.workspace.id,
    first.workspace.id,
  );
});

test("normal production has no review entry or role switching", async (t) => {
  const f = await fixture(t, false),
    browser = f.browser();
  assert.equal((await browser("/api/config")).body.review, false);
  assert.equal((await browser("/api/auth/review", {})).status, 404);
  assert.equal(
    (await browser("/api/auth/demo", { email: "maya@sopeasy.example" })).status,
    404,
  );
  assert.equal(f.store.get("SELECT COUNT(*) AS n FROM users").n, 0);
});
