import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const { getConfig } = await import("../lib/config");

function assertSafeToReset(dbPath: string): void {
  const dataDir = path.resolve(process.cwd(), "data");
  const inData = dbPath.startsWith(dataDir + path.sep);
  const inTemp = dbPath.startsWith(path.resolve(os.tmpdir()) + path.sep);
  const localSqlite = dbPath.endsWith(".db") || dbPath.endsWith(".sqlite");
  const confirmed = process.env.CONFIRM_DB_RESET === "yes";
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset a database when NODE_ENV=production.");
  }
  if ((!inData && !inTemp) || !localSqlite) {
    if (!confirmed) {
      throw new Error(
        `Refusing to reset ${dbPath}. Only local files under ./data or the OS temp directory are allowed. Set CONFIRM_DB_RESET=yes to override.`,
      );
    }
  }
}

const dbPath = path.resolve(process.cwd(), getConfig().SHARESPACE_DB_PATH);
assertSafeToReset(dbPath);
for (const suffix of ["", "-wal", "-shm"]) {
  const target = dbPath + suffix;
  if (fs.existsSync(target)) fs.rmSync(target);
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
console.log(`Reset local database at ${dbPath}.`);
