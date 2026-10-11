import test from "node:test";
import assert from "node:assert/strict";
import { database, digest } from "../server/db.mjs";
import { createApp, maintenance } from "../server/app.mjs";

async function fixture(t, { generate, beforeClose } = {}) {
  const store = database(":memory:");
  const previousDisabled = process.env.AI_DISABLED;
  let app;
  try {
    if (generate) process.env.AI_DISABLED = "false";
    app = createApp(store, {
      production: true,
      review: true,
      url: "https://review.example.test",
      ...(generate ? { generate } : {}),
    });
  } finally {
    if (previousDisabled === undefined) delete process.env.AI_DISABLED;
    else process.env.AI_DISABLED = previousDisabled;
  }
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await beforeClose?.();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  function browser(initialCookies = []) {
    const cookies = new Map(initialCookies);
    async function request(path, body) {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: [...cookies]
            .map(([key, value]) => `${key}=${value}`)
            .join("; "),
          Origin: "https://review.example.test",
          "Content-Type": "application/json",
          "x-sopeasy-request": "1",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [key, value] = cookie.split(";")[0].split("=");
        if (value) cookies.set(key, value);
        else cookies.delete(key);
      }
      return { status: response.status, body: await response.json() };
    }
    return { cookies, request };
  }
  return { store, browser };
}

async function open(browser) {
  assert.equal((await browser.request("/api/auth/review", {})).status, 200);
  const result = await browser.request("/api/bootstrap");
  assert.equal(result.status, 200);
  return result.body;
}

test("expired review capabilities reject access and maintenance removes only that visitor's sample data", async (t) => {
  const f = await fixture(t);
  const a = f.browser(),
    b = f.browser();
  const first = await open(a),
    second = await open(b);
  const users = f.store
    .members(first.workspace.id)
    .map((member) => member.user);
  // Exercise cleanup of all sample sessions, not only the current owner's.
  await a.request("/api/auth/demo", { email: "arjun@sopeasy.example" });
  await a.request("/api/auth/demo", { email: "leena@sopeasy.example" });
  for (const user of users) {
    f.store.run(
      "INSERT INTO tokens VALUES(?,?,?,?)",
      digest(`expired-visitor-token-${user}`),
      user,
      "reset",
      new Date(Date.now() + 86400000).toISOString(),
    );
  }
  const oldCookies = [...a.cookies];
  f.store.run(
    "UPDATE review_visits SET expires=? WHERE workspace=?",
    new Date(Date.now() - 1).toISOString(),
    first.workspace.id,
  );
  assert.equal((await a.request("/api/bootstrap")).status, 401);
  maintenance(f.store);
  assert.equal(f.store.read(first.workspace.id), null);
  assert.equal(f.store.members(first.workspace.id).length, 0);
  assert.equal(
    f.store.get(
      "SELECT COUNT(*) AS n FROM review_visits WHERE workspace=?",
      first.workspace.id,
    ).n,
    0,
  );
  for (const user of users) {
    assert.equal(
      f.store.get("SELECT id FROM users WHERE id=?", user),
      undefined,
    );
    assert.equal(
      f.store.get("SELECT COUNT(*) AS n FROM sessions WHERE user=?", user).n,
      0,
    );
    assert.equal(
      f.store.get("SELECT COUNT(*) AS n FROM tokens WHERE user=?", user).n,
      0,
    );
  }
  const survivor = await b.request("/api/bootstrap");
  assert.equal(survivor.status, 200);
  assert.equal(survivor.body.workspace.id, second.workspace.id);
  const fresh = await open(a);
  assert.notEqual(fresh.workspace.id, first.workspace.id);
  assert.equal(fresh.workspace.member.role, "Owner");
  assert.equal(
    (await f.browser(oldCookies).request("/api/bootstrap")).status,
    401,
  );
});

test("a session cookie from another visitor cannot be paired with one's own review capability", async (t) => {
  const f = await fixture(t);
  const a = f.browser(),
    b = f.browser();
  const first = await open(a),
    second = await open(b);
  const mixed = f.browser(a.cookies);
  mixed.cookies.set("sopeasy_session", b.cookies.get("sopeasy_session"));
  assert.equal((await mixed.request("/api/bootstrap")).status, 401);
  assert.equal(
    (
      await mixed.request(
        `/api/w/${second.workspace.id}/docs/${second.documents[0].id}`,
      )
    ).status,
    401,
  );
  const opposite = f.browser(b.cookies);
  opposite.cookies.set("sopeasy_session", a.cookies.get("sopeasy_session"));
  assert.equal((await opposite.request("/api/bootstrap")).status, 401);
  assert.equal(
    (await a.request("/api/bootstrap")).body.workspace.id,
    first.workspace.id,
  );
  assert.equal(
    (await b.request("/api/bootstrap")).body.workspace.id,
    second.workspace.id,
  );
});

test(
  "reset aborts its deferred AI request while another visitor's request and workspace survive",
  { timeout: 10000 },
  async (t) => {
    const calls = [],
      started = [];
    const generate = (_input, { signal }) =>
      new Promise((resolve, reject) => {
        const call = { signal, reject };
        calls.push(call);
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
        started.shift()?.();
      });
    const waitForCall = (index) =>
      calls[index]
        ? Promise.resolve()
        : new Promise((resolve) => started.push(resolve));
    const previousDisabled = process.env.AI_DISABLED;
    const f = await fixture(t, {
      generate,
      beforeClose: async () => {
        for (const call of calls)
          call.reject(new Error("Test provider stopped"));
        await new Promise((resolve) => setImmediate(resolve));
      },
    });
    assert.equal(process.env.AI_DISABLED, previousDisabled);
    const a = f.browser(),
      b = f.browser();
    const first = await open(a),
      second = await open(b);
    async function start(browser, workspace) {
      const draft = f.store
        .read(workspace)
        .state.documents.find((doc) => doc.candidate?.status === "Draft");
      assert.ok(draft);
      assert.equal(
        (
          await browser.request(
            `/api/w/${workspace}/docs/${draft.id}/generate`,
            { consent: true },
          )
        ).status,
        202,
      );
    }
    await start(a, first.workspace.id);
    await waitForCall(0);
    await start(b, second.workspace.id);
    await waitForCall(1);
    assert.equal(calls[0].signal.aborted, false);
    assert.equal(calls[1].signal.aborted, false);
    const oldCookies = [...a.cookies];
    assert.equal((await a.request("/api/auth/review-reset", {})).status, 200);
    assert.equal(calls[0].signal.aborted, true);
    assert.equal(calls[0].signal.reason.name, "AbortError");
    assert.equal(calls[1].signal.aborted, false);
    assert.equal(f.store.read(first.workspace.id), null);
    assert.equal(
      (await f.browser(oldCookies).request("/api/bootstrap")).status,
      401,
    );
    const survivor = await b.request("/api/bootstrap");
    assert.equal(survivor.status, 200);
    assert.equal(survivor.body.workspace.id, second.workspace.id);
    assert.equal(
      f.store
        .read(second.workspace.id)
        .state.documents.flatMap((doc) => doc.proposals)
        .filter((proposal) => proposal.status === "Generating").length,
      1,
    );
  },
);

test("a full sandbox pool refuses new visitors without locking out existing visitors", async (t) => {
  const f = await fixture(t);
  const existing = f.browser();
  const initial = await open(existing);
  // Populate the visit registry directly to reach the capacity boundary without
  // creating 99 copies of unrelated sample content and password hashes.
  const expires = new Date(Date.now() + 86400000).toISOString();
  for (let index = 1; index < 100; index++) {
    f.store.run(
      "INSERT INTO review_visits VALUES(?,?,?,?)",
      digest(`capacity-visitor-${index}`),
      `capacity-workspace-${index}`,
      "[]",
      expires,
    );
  }
  const countUsers = f.store.get("SELECT COUNT(*) AS n FROM users").n;
  const rejected = await f.browser().request("/api/auth/review", {});
  assert.equal(rejected.status, 429);
  assert.match(rejected.body.error, /sandbox is full/i);
  assert.equal(f.store.get("SELECT COUNT(*) AS n FROM users").n, countUsers);
  assert.equal((await existing.request("/api/auth/review", {})).status, 200);
  const resumed = await existing.request("/api/bootstrap");
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.workspace.id, initial.workspace.id);
  assert.equal(
    (
      await existing.request("/api/auth/demo", {
        email: "leena@sopeasy.example",
      })
    ).status,
    200,
  );
  assert.equal(
    (await existing.request("/api/bootstrap")).body.workspace.member.role,
    "Reader",
  );
});

test("the shared 50-request AI limit survives reset and cannot be bypassed by a new visitor", async (t) => {
  let providerCalls = 0;
  const f = await fixture(t, {
    generate: async () => {
      providerCalls++;
      throw new Error("Mock provider failure still consumes a request");
    },
  });
  const a = f.browser();
  const first = await open(a);
  const day = new Date().toISOString().slice(0, 10);
  f.store.run("INSERT INTO review_ai_usage VALUES(?,?)", day, 49);

  async function generate(browser, workspace) {
    const draft = f.store
      .read(workspace)
      .state.documents.find((doc) => doc.candidate?.status === "Draft");
    assert.ok(draft);
    return browser.request(`/api/w/${workspace}/docs/${draft.id}/generate`, {
      consent: true,
    });
  }
  // The final available request is admitted, including if the provider fails.
  assert.equal((await generate(a, first.workspace.id)).status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerCalls, 1);
  assert.equal(
    f.store.get("SELECT count FROM review_ai_usage WHERE day=?", day).count,
    50,
  );
  assert.equal((await a.request("/api/auth/review-reset", {})).status, 200);
  assert.equal(
    f.store.get("SELECT count FROM review_ai_usage WHERE day=?", day).count,
    50,
  );

  const fresh = await open(a);
  const b = f.browser();
  const another = await open(b);
  for (const [browser, workspace] of [
    [a, fresh.workspace.id],
    [b, another.workspace.id],
  ]) {
    const before = structuredClone(f.store.read(workspace).state);
    const rejected = await generate(browser, workspace);
    assert.equal(rejected.status, 429);
    assert.match(rejected.body.error, /daily limit of 50 AI requests/i);
    assert.deepEqual(f.store.read(workspace).state, before);
  }
  assert.equal(providerCalls, 1);
  assert.equal(
    f.store.get("SELECT count FROM review_ai_usage WHERE day=?", day).count,
    50,
  );
});
