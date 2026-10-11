import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
try {
  process.loadEnvFile(".env");
} catch {}
const directory = resolve(process.env.DATA_DIR || "data"),
  source = join(directory, "sopeasy.sqlite");
if (!existsSync(source))
  throw new Error("Start SOPEasy before creating a backup.");
const folder = join(directory, "backups");
mkdirSync(folder, { recursive: true });
const target = join(folder, `backup-${Date.now()}.sqlite`);
const db = new DatabaseSync(source);
db.exec(`VACUUM INTO '${target.replaceAll("'", "''").replaceAll("\\", "/")}'`);
db.close();
const backup = new DatabaseSync(target, { readOnly: true });
const integrity = backup.prepare("PRAGMA integrity_check").get();
const count = backup.prepare("SELECT count(*) AS n FROM workspaces").get().n;
backup.close();
if (integrity.integrity_check !== "ok")
  throw new Error("Backup integrity check failed.");
console.log(`Verified backup: ${target}\n${count} workspace(s); integrity: ok`);
