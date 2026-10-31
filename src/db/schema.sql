-- SpareLook schema (SQLite fallback, BR-05b).
-- All timestamps are ISO-8601 UTC strings with fixed width, so lexical order == time order.

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('BORROWER', 'OWNER', 'ADMIN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (institution_id, email)
);

CREATE TABLE IF NOT EXISTS user_tags (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('GROUP', 'TRAINING')),
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, kind, tag)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cameras_technical',
  asset_tag TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  accessories TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'DISABLED', 'ARCHIVED')),
  approval_required INTEGER NOT NULL DEFAULT 1 CHECK (approval_required IN (0, 1)),
  max_duration_hours INTEGER NOT NULL DEFAULT 72 CHECK (max_duration_hours > 0),
  open_time TEXT,
  close_time TEXT,
  allowed_groups TEXT NOT NULL DEFAULT '[]',
  required_trainings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (institution_id, asset_tag)
);
CREATE INDEX IF NOT EXISTS idx_resources_inst_status ON resources(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_resources_owner ON resources(owner_id);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  resource_id TEXT NOT NULL REFERENCES resources(id),
  requester_id TEXT NOT NULL REFERENCES users(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED', 'EXPIRED', 'CHECKED_OUT', 'RETURNED')),
  decision_reason TEXT,
  decided_by TEXT REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  late INTEGER NOT NULL DEFAULT 0 CHECK (late IN (0, 1)),
  discrepancy INTEGER NOT NULL DEFAULT 0 CHECK (discrepancy IN (0, 1)),
  fairness_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_at > start_at),
  UNIQUE (requester_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_bookings_resource_time ON bookings(resource_id, start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_requester_status ON bookings(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_inst_status ON bookings(institution_id, status);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id),
  reason_code TEXT,
  reason_text TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_booking ON booking_status_history(booking_id, created_at);

CREATE TABLE IF NOT EXISTS condition_reports (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  type TEXT NOT NULL CHECK (type IN ('CHECKOUT', 'RETURN')),
  overall_condition TEXT NOT NULL CHECK (overall_condition IN ('GOOD', 'MINOR_WEAR', 'DAMAGED', 'NOT_WORKING')),
  checklist TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL REFERENCES users(id),
  acknowledged_at TEXT,
  acknowledged_by TEXT REFERENCES users(id),
  disputed INTEGER NOT NULL DEFAULT 0 CHECK (disputed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (booking_id, type)
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  resource_id TEXT NOT NULL REFERENCES resources(id),
  booking_id TEXT REFERENCES bookings(id),
  reporter_id TEXT REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('DAMAGE', 'MISSING_ITEM', 'LATE_RETURN', 'CONDITION_DISPUTE', 'OTHER')),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
  resolution_note TEXT,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_inst_status ON incidents(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_resource ON incidents(resource_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
  metadata TEXT NOT NULL DEFAULT '{}',
  request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_inst_time ON audit_events(institution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);

-- BR-05b: database-level overlap prevention for blocking statuses.
CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_insert
BEFORE INSERT ON bookings
WHEN NEW.status IN ('APPROVED', 'CHECKED_OUT')
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_CONFLICT')
  WHERE EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.resource_id = NEW.resource_id
      AND b.id <> NEW.id
      AND b.status IN ('APPROVED', 'CHECKED_OUT')
      AND b.start_at < NEW.end_at
      AND b.end_at > NEW.start_at
  );
END;

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_update
BEFORE UPDATE OF start_at, end_at, status, resource_id ON bookings
WHEN NEW.status IN ('APPROVED', 'CHECKED_OUT')
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_CONFLICT')
  WHERE EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.resource_id = NEW.resource_id
      AND b.id <> NEW.id
      AND b.status IN ('APPROVED', 'CHECKED_OUT')
      AND b.start_at < NEW.end_at
      AND b.end_at > NEW.start_at
  );
END;

-- Append-only protections (application + database; not tamper-proof).
CREATE TRIGGER IF NOT EXISTS audit_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS bookings_no_delete
BEFORE DELETE ON bookings
BEGIN
  SELECT RAISE(ABORT, 'BOOKINGS_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS reports_no_delete
BEFORE DELETE ON condition_reports
BEGIN
  SELECT RAISE(ABORT, 'REPORTS_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS incidents_no_delete
BEFORE DELETE ON incidents
BEGIN
  SELECT RAISE(ABORT, 'INCIDENTS_APPEND_ONLY');
END;
