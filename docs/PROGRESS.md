# Progress log

## 2026-10-30 — Phase 0 (reconnaissance)

- Inspected `C:\Users\Dell\Desktop\HACKU\ShareSpace`: no README, no app code, no
  registries; only the supplied guide and a prompt file.
- Runtime: Node v24.11.1, npm 11.6.2, git 2.53.0. No `psql`, no `sqlite3` CLI,
  Docker CLI present but daemon not running.
- Decision: SQLite fallback per BR-05b; see `docs/DECISIONS.md`.
- `git init` performed; no commits or pushes (owner handles git).

## 2026-10-30 — Phase 1 (registers and plan)

- Created `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`,
  `docs/TASKS.md`.
- Stack chosen: Next.js 16 App Router, React 19, TypeScript strict, SQLite
  (`better-sqlite3`), Zod 4, bcryptjs, hand-written CSS.
- Conflict strategy: `BEGIN IMMEDIATE` writes + SQLite trigger rejecting
  overlapping `APPROVED`/`CHECKED_OUT` bookings.

## 2026-10-30 — Phase 2 (scaffold and tooling)

- Created `package.json`, `tsconfig.json`, `next.config.ts`, ESLint/Prettier
  config, `.gitignore`, `.env.example`, `vitest.config.ts`.
- Added scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `format:check`,
  `test`, `test:watch`, `db:migrate`, `db:seed`, `db:reset`, `db:expire`,
  `demo:reset`, `test:concurrency`.
- Installed dependencies; config module with Zod validation, structured logger,
  error classes and request ids; `/api/health` route.

## 2026-10-30 — Phase 3 (design system)

- CSS variables, typography, focus ring, reduced-motion block, responsive
  container in `src/app/globals.css`.
- Reusable components: badges, forms, alerts, empty/error states, stepper,
  timeline, navigation, page headers; no CSS framework or template.

## 2026-10-30 — Phase 4 (database and seed)

- `src/db/schema.sql` with entities, FKs, CHECKs, indexes, booking-overlap
  trigger, append-only audit triggers, unique `(booking_id, type)` condition
  reports and unique idempotency keys.
- Schema applied via `src/db/migrate.ts`; guarded `src/db/reset.ts` that only
  deletes local `./data` or OS-temp DB files and refuses production.
- Deterministic, time-relative fictional seed (8 users, 10 resources, history,
  one resolved incident, one future approved R01 booking, overlapping R02
  requests, Sana's heavy usage).
- TC-CONC-00 direct-insert smoke (`scripts/smoke-check.ts`).

## 2026-10-30 — Phase 5 (auth and authorization)

- Session auth: bcrypt hashes, 256-bit random tokens stored as SHA-256, httpOnly
  SameSite=Lax cookie, idle 8 h / absolute 24 h expiry, revocation.
- Sign-in rate limit 10/15 min per email+IP; generic 401 message; suspension
  handling; origin check on mutations; denial auditing.
- Central `withApi` wrapper with deny-by-default session and role gates.

## 2026-10-30 — Phase 6 (catalogue and eligibility)

- Catalogue API/UI with search, type/location/eligibility filters, pagination,
  hidden archived resources, maintenance badges.
- Resource detail with availability blocks and eligibility panel; pure
  eligibility rules shared by UI and server.

## 2026-10-30 — Phase 7 (booking and conflicts)

- Pure time/validation modules (institution zone, half-open intervals,
  15-minute grid, 60-minute minimum, 30-day advance).
- Booking creation with `Idempotency-Key`, policy limits, status history, audit,
  and DB-level conflict rejection.
- Multi-process concurrency harness: 20 creation-race rounds and 20 idempotency
  rounds, 4 processes each — all passed.

## 2026-10-30 — Phase 8 (approval, FairShare, waitlist)

- FairShare ranking by 30-day usage, creation time and id; explanations without
  other users' identities; override reason required for rank > 1.
- Owner queue, approve/reject/cancel, supersede overlapping PENDING requests to
  `WAITLISTED`, waitlist promotion and lazy expiry.

## 2026-10-30 — Phase 9 (checkout/return)

- Checkout window opens 30 min before start and closes after booking end;
  manager-only checkout/return; unique condition reports.
- Return comparison, discrepancy flag, automatic `MISSING_ITEM`/`DAMAGE`
  incidents, 15-minute late grace and `LATE_RETURN` incident.

## 2026-10-30 — Phase 10 (incidents, Passport, audit)

- Incident report/list/detail, status lifecycle (`OPEN → INVESTIGATING →
RESOLVED`, admin reopen), role-scoped visibility.
- Resource Passport: full owner/admin timeline vs borrower summary; ordered
  events and condition evidence.
- Append-only audit writer, admin audit page, denial logging.

## 2026-10-30 — Phase 11 (admin)

- Admin/owner resource create/edit, status changes with affected-booking count,
  owner reassignment; admin user tag/status pages; audit page.
- User suspension revokes sessions; self-suspension is rejected.
- Admin users/tags: routes and UI exist but are not covered by tests or a UI
  click-through.

## 2026-10-30 — Phase 12 (states, responsive, accessibility)

- Loading, error, not-found, forbidden, empty and success states added.
- Fixed two responsive defects found in browser checks: inline sign-in grid
  override and mobile header nav overflow.
- Headless Chrome check at 360×800: 15/15 checks, screenshots captured.
- Not run: axe scan, contrast script, full keyboard journey.

## 2026-10-30 — Phase 13 (tests and e2e)

- 15 test files / 130 tests pass; typecheck and lint clean; production build
  succeeds (one Turbopack tracing warning).
- HTTP smoke 14/14; demo D1–D12 28/28; UI click-through 8/8.
- Fixed one UI assertion (case-sensitive "Pending" vs rendered "PENDING"),
  corrected a wrong HTTP error-code expectation, and fixed a seed booking that
  could fall outside opening hours.
- Full test report and per-case mapping: `docs/TEST_REPORT.md`.

## 2026-10-30 — Phase 14 (security review)

- Walked SEC-01..12 and AB-01..10; dependency audit clean; secret scan clean.
- Limitations documented: origin check only when header present, in-memory rate
  limit, CSP `unsafe-inline`, append-only not tamper-proof, several controls not
  test-enforced. See `docs/SECURITY_REVIEW.md`.

## 2026-10-30 — Phase 15 (demo)

- Demo run log recorded in `docs/evidence/demo-run.md` (28/28).
- D7–D9 use the auto-approve lavalier resource created in D1 because the seeded
  R01 slot falls outside the checkout window; documented as a deviation.
- Demo DB reset to the pristine seed after the final UI run.

## 2026-10-30 — Phase 16 (documentation)

- Created `README.md`, `docs/TEST_REPORT.md`, `docs/SECURITY_REVIEW.md` and
  `docs/FINAL_CHECKLIST.md`; updated the registers.
- No README existed at start; the guide's "39 sections" structure could not be
  preserved and was replaced with a reality-based structure.
- Section 18 gate reported as **not fully satisfied** (see
  `docs/FINAL_CHECKLIST.md`); no completion or production claim is made.
- No git commit or push performed; the owner handles all git operations.
