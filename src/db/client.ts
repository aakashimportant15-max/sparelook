import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../lib/config";

type DbGlobal = typeof globalThis & { __sharespaceDb?: Database.Database };

export function getDbPath(): string {
  const configured = getConfig().SHARESPACE_DB_PATH;
  if (configured === ":memory:") return configured;
  return path.resolve(process.cwd(), configured);
}

export function getDb(): Database.Database {
  const globalRef = globalThis as DbGlobal;
  if (globalRef.__sharespaceDb) return globalRef.__sharespaceDb;
  const dbPath = getDbPath();
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  globalRef.__sharespaceDb = db;
  return db;
}

export function closeDb(): void {
  const globalRef = globalThis as DbGlobal;
  if (globalRef.__sharespaceDb) {
    globalRef.__sharespaceDb.close();
    delete globalRef.__sharespaceDb;
  }
}

/**
 * SQLite fallback for serializable writes (BR-05b): BEGIN IMMEDIATE takes the
 * write lock up front so concurrent writers queue instead of racing.
 */
export function transactionImmediate<T>(fn: () => T): T {
  const db = getDb();
  const tx = db.transaction(fn);
  return tx.immediate();
}

export function nowIso(): string {
  return new Date().toISOString();
}
