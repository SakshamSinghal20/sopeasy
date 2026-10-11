import { performance } from "node:perf_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { database, passwordHash } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";
import * as D from "../server/domain.mjs";
const store = database(":memory:"),
  user = {
    id: D.id(),
    name: "Benchmark Owner",
    email: "benchmark@example.test",
  };
store.run(
  "INSERT INTO users VALUES(?,?,?,?,1)",
  user.id,
  user.name,
  user.email,
  passwordHash("Benchmark-password!"),
);
const wid = store.createWorkspace(user, "Fictional benchmark");
const member = store.members(wid)[0];
const identities = [user];
const fixturePassword = passwordHash("Benchmark-password!");
for (let i = 1; i < 50; i++) {
  const identity = {
    id: D.id(),
    name: `Benchmark member ${i}`,
    email: `benchmark-${i}@example.test`,
  };
  store.run(
    "INSERT INTO users VALUES(?,?,?,?,1)",
    identity.id,
    identity.name,
    identity.email,
    fixturePassword,
  );
  store.run(
    "INSERT INTO memberships(id,workspace,user,role) VALUES(?,?,?,?)",
    D.id(),
    wid,
    identity.id,
    i < 10 ? "Admin" : "Reader",
  );
  identities.push(identity);
}
store.transaction(wid, (w, s) => {
  for (let i = 0; i < 1000; i++) {
    const doc = D.createDoc(s, member, {
      title: `Office procedure ${i}`,
      sources: "Fictional operations source notes.",
    });
    doc.candidate.content = {
      ...D.emptyContent(),
      purpose: "Handle office requests consistently.",
      scope: "Office operations team.",
      steps: Array.from({ length: 5 }, (_, j) => ({
        id: D.id(),
        title: `Step ${j + 1}`,
        body: "The process owner records the request and confirms the outcome with the requester. ".repeat(
          5,
        ),
        responsible: "Operations",
      })),
    };
    doc.current = 1;
    doc.versions = [
      {
        id: D.id(),
        number: 1,
        title: doc.title,
        content: structuredClone(doc.candidate.content),
        sources: doc.candidate.sources,
        published: D.now(),
        publisher: member.name,
      },
    ];
  }
});
const app = createApp(store, { demo: false }),
  server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}`;
const headers = {
  "Content-Type": "application/json",
  "x-sopeasy-request": "1",
};
const clientHeaders = [];
for (const identity of identities.slice(0, 10)) {
  const login = await fetch(url + "/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: identity.email,
      password: "Benchmark-password!",
    }),
  });
  if (!login.ok) throw new Error(`Benchmark login: ${login.status}`);
  clientHeaders.push({
    ...headers,
    Cookie: login.headers.get("set-cookie").split(";")[0],
  });
}
const report = {
  envelope: {
    procedures: 1000,
    stepsEach: 5,
    activeMembers: 50,
    concurrentClients: 10,
    network: "local loopback; excludes browser rendering",
  },
  results: {},
};
async function measure(name, path, input, count = 100) {
  const samples = [];
  await Promise.all(
    clientHeaders.map(async (requestHeaders, client) => {
      for (let round = 0; round < count / clientHeaders.length; round++) {
        const start = performance.now();
        const response = await fetch(
          url + (typeof path === "function" ? path(client) : path),
          {
            headers: requestHeaders,
            method: input ? "PUT" : "GET",
            ...(input ? { body: JSON.stringify(input(round, client)) } : {}),
          },
        );
        if (!response.ok)
          throw new Error(
            `${name}: ${response.status}: ${await response.text()}`,
          );
        await response.arrayBuffer();
        samples.push(performance.now() - start);
      }
    }),
  );
  samples.sort((a, b) => a - b);
  report.results[name] = {
    requests: count,
    p95Ms: Math.round(samples[Math.ceil(count * 0.95) - 1] * 100) / 100,
  };
}
try {
  await measure("Library", `/api/w/${wid}/docs?page=1&pageSize=24`);
  await measure("Search", `/api/w/${wid}/search?q=request`);
  const docs = store.read(wid).state.documents.slice(0, 10);
  await measure(
    "Autosave",
    (client) => `/api/w/${wid}/docs/${docs[client].id}`,
    (round, client) => ({
      revision: round + 1,
      content: {
        ...docs[client].candidate.content,
        purpose: "Benchmark save " + round,
      },
      sources: docs[client].candidate.sources,
    }),
  );
  mkdirSync(".qa", { recursive: true });
  writeFileSync(".qa/performance.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  store.close();
}
