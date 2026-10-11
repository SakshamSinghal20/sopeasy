import test from "node:test";
import assert from "node:assert/strict";
import { database, passwordHash } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";
import * as D from "../server/domain.mjs";

test("workspace administration completes invitations, roles, distribution, maintenance, duplication, ownership and export", async (t) => {
  const store = database(":memory:");
  const roles = ["Owner", "Author", "Reader", "Admin", "Reader"];
  const users = roles.map((role, index) => ({
    id: D.id(),
    name: `QA ${role} ${index}`,
    email: `qa${index}@example.test`,
    role,
  }));
  for (const user of users)
    store.run(
      "INSERT INTO users VALUES(?,?,?,?,1)",
      user.id,
      user.name,
      user.email,
      passwordHash("QA-password-2026!"),
    );
  const wid = store.createWorkspace(
    users[0],
    "Administration QA",
    "Asia/Calcutta",
  );
  for (const user of users.slice(1, 4))
    store.run(
      "INSERT INTO memberships(id,workspace,user,role) VALUES(?,?,?,?)",
      D.id(),
      wid,
      user.id,
      user.role,
    );
  const server = createApp(store, { demo: false }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`,
    base = `/api/w/${wid}`,
    cookies = [];
  for (const user of users) {
    const response = await fetch(url + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sopeasy-request": "1" },
      body: JSON.stringify({
        email: user.email,
        password: "QA-password-2026!",
      }),
    });
    assert.equal(response.status, 200);
    cookies.push(response.headers.get("set-cookie").split(";")[0]);
  }
  async function api(path, body, actor = 0, method) {
    const response = await fetch(url + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        Cookie: cookies[actor],
        "Content-Type": "application/json",
        "x-sopeasy-request": "1",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  const expect = (response, status = 200) => {
    assert.equal(response.status, status, JSON.stringify(response.body));
    return response.body;
  };
  const members = store.members(wid),
    member = (index) => members.find((m) => m.user === users[index].id);
  const bootstrap = (actor = 0) =>
    api(`/api/bootstrap?workspace=${wid}`, undefined, actor);
  const future = (days) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  // Settings persist, and lower-privilege members cannot change them.
  expect(
    await api(base + "/settings", {
      name: "Administration QA updated",
      timezone: "Asia/Kolkata",
    }),
  );
  const setup = expect(await bootstrap());
  assert.equal(setup.workspace.name, "Administration QA updated");
  assert.equal(setup.workspace.timezone, "Asia/Kolkata");
  expect(await api(base + "/settings", { name: "Unauthorized" }, 2), 403);
  expect(await api(base + "/settings", { timezone: "Invalid/Zone" }), 400);
  assert.equal(expect(await bootstrap()).workspace.timezone, "Asia/Kolkata");
  assert.equal(setup.templates.length, 4);
  for (const template of setup.templates) {
    const created = expect(
      await api(
        base + "/docs",
        { title: `Template ${template.name}`, template: template.id },
        1,
      ),
    ).doc;
    assert.equal(created.category, template.category);
    assert.equal(created.template, template.id);
    assert.equal(created.current, 0);
  }

  // A real signed-in invitation recipient joins after publication below.
  expect(
    await api(base + "/invites", {
      email: "revoked@example.test",
      role: "Reader",
    }),
  );
  const pending = expect(await api(base + "/invites")).find(
    (i) => i.email === "revoked@example.test",
  );
  expect(await api(base + `/invites/${pending.id}/revoke`, {}));
  assert.equal(
    expect(await api(base + "/invites")).find((i) => i.id === pending.id)
      .revoked,
    1,
  );
  expect(
    await api(
      base + "/invites",
      { email: "admin@example.test", role: "Admin" },
      3,
    ),
    403,
  );
  expect(
    await api(base + `/members/${member(2).id}`, { role: "Author" }, 1),
    403,
  );
  expect(await api(base + `/members/${member(2).id}`, { role: "Author" }));
  assert.equal(
    store.members(wid).find((m) => m.id === member(2).id).role,
    "Author",
  );
  expect(await api(base + `/members/${member(2).id}`, { role: "Reader" }));

  let doc = expect(
    await api(base + "/docs", {
      title: "Published administration journey",
      sources: "Operations checks the room booking.",
    }),
  ).doc;
  const content = {
    ...D.emptyContent(),
    purpose: "Prepare a meeting room.",
    scope: "Office operations.",
    steps: [
      {
        id: D.id(),
        title: "Check booking",
        body: "Operations checks the room booking.",
        responsible: "Operations",
      },
    ],
  };
  doc = expect(
    await api(
      base + `/docs/${doc.id}`,
      {
        revision: doc.candidate.revision,
        content,
        sources: doc.candidate.sources,
      },
      0,
      "PUT",
    ),
  ).doc;
  const action = (body, actor = 0) =>
    api(base + `/docs/${doc.id}/action`, body, actor);
  doc = expect(
    await action({
      action: "submit",
      reviewer: member(1).id,
      revision: doc.candidate.revision,
    }),
  ).result;
  doc = expect(
    await action(
      {
        action: "review",
        decision: "approve",
        submission: doc.candidate.submission.id,
      },
      1,
    ),
  ).result;
  doc = expect(
    await action({
      action: "publish",
      key: D.id(),
      revision: doc.candidate.revision,
      current: 0,
      confirmed: true,
      summary: "First publication",
      reviewDue: future(90),
      requireAcknowledgement: true,
      recipients: [member(2).id],
      deadline: future(7),
    }),
  ).result;
  assert.equal(doc.current, 1);
  const published = structuredClone(doc.versions[0]);

  expect(
    await action({
      action: "maintenance",
      date: future(120),
      note: "Checked current process; no changes needed.",
    }),
  );
  const maintained = expect(await api(base + `/docs/${doc.id}`)).doc;
  assert.equal(maintained.current, 1);
  assert.deepEqual(maintained.versions[0], published);
  assert.match(maintained.reviewDue, new RegExp(future(120)));
  expect(
    await action({ action: "maintenance", date: future(130), note: "" }),
    400,
  );
  expect(await action({ action: "transfer", owner: member(3).id }, 1), 403);
  expect(await action({ action: "transfer", owner: member(3).id }));
  assert.equal(
    expect(await api(base + `/docs/${doc.id}`)).doc.owner,
    member(3).id,
  );

  const copy = expect(await action({ action: "duplicate" }, 1)).result;
  assert.equal(copy.current, 0);
  assert.equal(copy.owner, member(1).id);
  assert.deepEqual(copy.candidate.content, published.content);
  assert.equal(copy.candidate.sources, "");
  assert.equal(copy.versions.length, 0);
  expect(await api(base + `/docs/${copy.id}`, undefined, 2), 403);

  const invited = expect(
    await api(base + "/invites", { email: users[4].email, role: "Reader" }),
  );
  const token = new URL(invited.developmentLink).searchParams.get("invite");
  expect(await api(`/api/invitation/${token}`, {}, 4));
  const joiner = store.members(wid).find((m) => m.user === users[4].id);
  assert.equal(expect(await bootstrap(4)).tasks.length, 0);
  expect(
    await action(
      { action: "assign", recipients: [joiner.id], deadline: future(5) },
      3,
    ),
  );
  let tasks = expect(await bootstrap(4)).tasks;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].version, 1);
  const notice = expect(await bootstrap(4)).notifications.find(
    (n) => n.target === doc.id,
  );
  assert(notice && !notice.read);
  expect(await api(base + "/notifications/read", { id: notice.id }, 4));
  assert.equal(
    expect(await bootstrap(4)).notifications.find((n) => n.id === notice.id)
      .read,
    true,
  );
  const receipt = expect(
    await action({ action: "acknowledge", version: 1, confirmed: true }, 4),
  ).result;
  assert.equal(receipt.version, 1);
  expect(await api(base + `/members/${joiner.id}`, { active: false }));
  expect(await bootstrap(4), 401);
  const exported = expect(await api(base + "/export.json"));
  assert.equal(exported.format, "sopeasy-workspace-v1");
  assert(exported.assignments.some((a) => a.member === joiner.id && a.receipt));
  assert(exported.members.some((m) => m.id === joiner.id && !m.active));
  assert(exported.maintenance.some((m) => m.doc === doc.id && m.version === 1));
  assert(exported.audit.some((e) => e.action === "Transferred ownership"));
  expect(await api(base + "/export.json", undefined, 2), 403);

  // Workspace ownership transfer leaves exactly one owner and protects admin changes.
  expect(await api(base + "/settings", { owner: member(3).id }));
  assert.equal(store.members(wid).filter((m) => m.role === "Owner").length, 1);
  assert.equal(
    store.members(wid).find((m) => m.id === member(3).id).role,
    "Owner",
  );
  assert.equal(
    store.members(wid).find((m) => m.id === member(0).id).role,
    "Admin",
  );
  expect(await api(base + `/members/${member(1).id}`, { role: "Admin" }), 403);
});
