import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import express from "express";
import { database, seed } from "./server/db.mjs";
import { createApp, maintenance } from "./server/app.mjs";
try {
  process.loadEnvFile(".env");
} catch {}
const production = process.env.NODE_ENV === "production";
const review = process.env.REVIEW_MODE === "true";
const port = Number(process.env.PORT || 4197);
const host = process.env.HOST || "127.0.0.1";
if (
  production &&
  (!process.env.APP_URL?.startsWith("https://") ||
    (!review && !process.env.SMTP_HOST) ||
    process.env.DEMO_MODE === "true")
)
  throw new Error(
    "Production requires HTTPS APP_URL, SMTP configuration and DEMO_MODE=false.",
  );
const data = resolve(process.env.DATA_DIR || "data");
mkdirSync(data, { recursive: true });
const store = database(join(data, review ? "review.sqlite" : "sopeasy.sqlite"));
if (!production && process.env.DEMO_MODE === "true") seed(store);
for (const row of store.all("SELECT id FROM workspaces"))
  store.transaction(row.id, (w, s) => {
    for (const doc of s.documents)
      for (const p of doc.proposals)
        if (["Queued", "Generating"].includes(p.status)) {
          p.status = "Failed";
          p.error =
            "The server restarted. Generate again; your draft is unchanged.";
        }
  });
const app = createApp(store);
if (production) {
  if (process.env.API_ONLY !== "true") {
    app.use(express.static("dist"));
    app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
  }
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, host, () =>
  console.log(`SOPEasy running at http://${host}:${port}`),
);
const jobs = setInterval(() => {
  try {
    maintenance(store);
  } catch {
    console.error("Maintenance needs attention.");
  }
}, 60000);
jobs.unref();
maintenance(store);
async function backup() {
  try {
    const folder = join(data, "backups");
    mkdirSync(folder, { recursive: true });
    store.db.exec(
      `VACUUM INTO '${join(folder, `backup-${Date.now()}.sqlite`).replaceAll("'", "''").replaceAll("\\", "/")}'`,
    );
    for (const name of readdirSync(folder))
      if (
        /^backup-\d+\.sqlite$/.test(name) &&
        Number(name.slice(7, -7)) < Date.now() - 30 * 86400000
      )
        unlinkSync(join(folder, name));
    return true;
  } catch {
    console.error("Backup needs attention.");
    return false;
  }
}
const backupFolder = join(data, "backups");
const latestBackup = existsSync(backupFolder)
  ? Math.max(
      0,
      ...readdirSync(backupFolder)
        .filter((name) => /^backup-\d+\.sqlite$/.test(name))
        .map((name) => Number(name.slice(7, -7)))
        .filter((time) => time <= Date.now()),
    )
  : 0;
let backups;
function scheduleBackup(delay) {
  backups = setTimeout(async () => {
    const completed = await backup();
    scheduleBackup(completed ? 86400000 : 300000);
  }, delay);
  backups.unref();
}
scheduleBackup(Math.max(1, latestBackup + 86400000 - Date.now()));
function shutdown() {
  clearInterval(jobs);
  clearTimeout(backups);
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
