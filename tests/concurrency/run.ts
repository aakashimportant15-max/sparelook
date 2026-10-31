/**
 * Multi-process concurrency harness (TC-CONC).
 * Each round seeds a throwaway SQLite file, spawns four independent Node
 * processes that race for the same slot, then checks the outcome.
 *
 * Run with: npm run test:concurrency
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const ROUNDS_CONFLICT = Number(process.env.CONC_ROUNDS_CONFLICT ?? 20);
const ROUNDS_IDEMPOTENT = Number(process.env.CONC_ROUNDS_IDEMPOTENT ?? 20);
const WORKERS = 4;
const USERS = ["u-dev", "u-rohan", "u-isha", "u-sana"];

const here = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.join(here, "worker.ts");
const projectRoot = path.resolve(here, "..", "..");

type Result = { ok: boolean; code?: string; bookingId?: string; message?: string };

const workDir = mkdtempSync(path.join(os.tmpdir(), "sharespace-conc-"));
let failures = 0;

async function prepareRound(
  round: number,
): Promise<{ file: string; startAt: string; endAt: string }> {
  const file = path.join(workDir, `round-${round}.db`);
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.SHARESPACE_DB_PATH = file;
  process.env.INSTITUTION_TIMEZONE = "Asia/Kolkata";

  const { closeDb } = await import("../../src/db/client");
  const { resetConfigForTests } = await import("../../src/lib/config");
  const { applySchema } = await import("../../src/db/schema");
  const { seedDatabase } = await import("../../src/db/seed-data");

  resetConfigForTests();
  closeDb();
  applySchema();
  seedDatabase({ demoPassword: "ConcPass123!", hashRounds: 4 });
  closeDb();

  const base = Date.now() + 2 * 86_400_000 + round * 3 * 3_600_000;
  const startMs = Math.ceil(base / 900_000) * 900_000;
  return {
    file,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + 2 * 3_600_000).toISOString(),
  };
}

function runWorker(env: Record<string, string>): Promise<Result> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", workerPath], {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith("RESULT:"));
      if (!line) {
        resolve({
          ok: false,
          code: "WORKER_CRASHED",
          message: `exit=${code} stderr=${stderr.trim().slice(0, 400)}`,
        });
        return;
      }
      resolve(JSON.parse(line.slice("RESULT:".length)) as Result);
    });
  });
}

function countForKey(file: string, key: string): number {
  const db = new Database(file, { readonly: true });
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM bookings WHERE idempotency_key = ?")
    .get(key) as { count: number };
  db.close();
  return row.count;
}

async function conflictRound(round: number): Promise<void> {
  const { file, startAt, endAt } = await prepareRound(round);
  const results = await Promise.all(
    USERS.map((userId, index) =>
      runWorker({
        CONC_USER_ID: userId,
        CONC_START_AT: startAt,
        CONC_END_AT: endAt,
        CONC_KEY: `conc-conflict-${round}-${index}`,
      }),
    ),
  );
  const winners = results.filter((result) => result.ok);
  const conflicts = results.filter(
    (result) => !result.ok && result.code === "BOOKING_CONFLICT",
  );
  const passed = winners.length === 1 && conflicts.length === WORKERS - 1;
  if (!passed) {
    failures += 1;
    console.error(`FAIL  TC-CONC-01 round ${round + 1}: ${JSON.stringify(results)}`);
  } else {
    console.log(
      `PASS  TC-CONC-01 round ${round + 1}: 1 winner, ${conflicts.length} conflicts`,
    );
  }
  rmSync(file, { force: true });
  rmSync(`${file}-wal`, { force: true });
  rmSync(`${file}-shm`, { force: true });
}

async function idempotentRound(round: number): Promise<void> {
  const { file, startAt, endAt } = await prepareRound(round);
  const key = `conc-idem-${round}`;
  const results = await Promise.all(
    USERS.map(() =>
      runWorker({
        CONC_USER_ID: "u-dev",
        CONC_START_AT: startAt,
        CONC_END_AT: endAt,
        CONC_KEY: key,
      }),
    ),
  );
  const ids = new Set(
    results.filter((result) => result.ok).map((result) => result.bookingId),
  );
  const stored = countForKey(file, key);
  const passed = results.every((result) => result.ok) && ids.size === 1 && stored === 1;
  if (!passed) {
    failures += 1;
    console.error(
      `FAIL  TC-CONC-02 round ${round + 1}: ids=${ids.size} stored=${stored} ${JSON.stringify(results)}`,
    );
  } else {
    console.log(`PASS  TC-CONC-02 round ${round + 1}: all workers replayed one booking`);
  }
  rmSync(file, { force: true });
  rmSync(`${file}-wal`, { force: true });
  rmSync(`${file}-shm`, { force: true });
}

try {
  console.log(
    `Running ${ROUNDS_CONFLICT} conflict rounds and ${ROUNDS_IDEMPOTENT} idempotency rounds...`,
  );
  for (let round = 0; round < ROUNDS_CONFLICT; round += 1) {
    await conflictRound(round);
  }
  for (let round = 0; round < ROUNDS_IDEMPOTENT; round += 1) {
    await idempotentRound(round);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} round(s) failed.`);
  process.exit(1);
}
console.log("\nAll concurrency rounds passed.");
