import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "./client";

export function applySchema(): void {
  const db = getDb();
  const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  db.pragma("user_version = 1");
}
