import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { closeDb } from "../../src/db/client";
import { applySchema } from "../../src/db/schema";
import { seedDatabase } from "../../src/db/seed-data";
import { resetConfigForTests } from "../../src/lib/config";

let databaseFile: string | null = null;

/** Dedicated throwaway SQLite file per worker process; never the demo database. */
export function databasePath(): string {
  if (databaseFile) return databaseFile;
  if (process.env.SHARESPACE_TEST_DB_PATH) {
    databaseFile = process.env.SHARESPACE_TEST_DB_PATH;
  } else {
    databaseFile = path.join(
      os.tmpdir(),
      `sharespace-test-${process.pid}-${randomUUID()}.db`,
    );
  }
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.SHARESPACE_DB_PATH = databaseFile;
  process.env.INSTITUTION_TIMEZONE = "Asia/Kolkata";
  process.env.DEMO_USER_PASSWORD = "TestPass123!";
  resetConfigForTests();
  return databaseFile;
}

function removeFiles(file: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    const candidate = `${file}${suffix}`;
    if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
  }
}

/** Rebuild the schema and product seed data so each test starts from a known state. */
export function resetDatabase(
  options: { includeSecondInstitution?: boolean; now?: Date } = {},
): void {
  const file = databasePath();
  closeDb();
  removeFiles(file);
  applySchema();
  seedDatabase({
    demoPassword: "TestPass123!",
    includeSecondInstitution: options.includeSecondInstitution ?? false,
    hashRounds: 4,
    now: options.now,
  });
}

export function teardownDatabase(): void {
  const file = databasePath();
  closeDb();
  removeFiles(file);
}
