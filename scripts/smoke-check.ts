import Database from "better-sqlite3";
import fs from "node:fs";

const path = "data/smoke-check.db";
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    fs.rmSync(path + suffix);
  } catch {}
}
const db = new Database(path);
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync("src/db/schema.sql", "utf8"));
const t = "2026-11-03T04:30:00.000Z";
db.prepare("INSERT INTO institutions VALUES ('i','I','Asia/Kolkata',?,?)").run(t, t);
db.prepare(
  "INSERT INTO users (id,institution_id,email,display_name,role,status,password_hash,created_at,updated_at) VALUES ('u','i','a@b.example','A','ADMIN','ACTIVE','x',?,?)",
).run(t, t);
db.prepare(
  "INSERT INTO resources (id,institution_id,owner_id,name,type,asset_tag,location,description,status,created_at,updated_at) VALUES ('r','i','u','R','CAMERA','A1','L','D','ACTIVE',?,?)",
).run(t, t);
const insert = db.prepare(
  "INSERT INTO bookings (id,institution_id,resource_id,requester_id,start_at,end_at,purpose,status,idempotency_key,created_at,updated_at) VALUES (?, 'i','r','u',?,?,'test','APPROVED',?,?,?)",
);
insert.run("b1", "2026-11-03T04:30:00.000Z", "2026-11-03T07:30:00.000Z", "k1", t, t);
let overlap = "NO-ERROR";
try {
  insert.run("b2", "2026-11-03T06:30:00.000Z", "2026-11-03T09:30:00.000Z", "k2", t, t);
} catch (error) {
  overlap = (error as Error).message;
}
insert.run("b3", "2026-11-03T07:30:00.000Z", "2026-11-03T10:30:00.000Z", "k3", t, t);
db.prepare(
  "INSERT INTO audit_events (id,institution_id,action,entity_type,outcome,created_at) VALUES ('a','i','x','y','SUCCESS',?)",
).run(t);
let auditDelete = "NO-ERROR";
try {
  db.exec("DELETE FROM audit_events");
} catch (error) {
  auditDelete = (error as Error).message;
}
console.log("overlap ->", overlap);
console.log("adjacent -> OK (inserted b3)");
console.log("audit delete ->", auditDelete);
db.close();
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    fs.rmSync(path + suffix);
  } catch {}
}
