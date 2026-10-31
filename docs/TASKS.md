# Task checklist

Checked items are implemented and verified by an executed command or recorded
run. Items with a note are implemented but only partly verified. Unchecked items
are not done or not verified; see `docs/FINAL_CHECKLIST.md` for the full list.

## Phase 0 — Reconnaissance

- [x] Inspect workspace, runtime, database tooling, git state
- [x] Record baseline report

## Phase 1 — Decisions and registers

- [x] Create assumptions, decisions, progress, task registers
- [x] Choose stack, database, conflict strategy

## Phase 2 — Scaffold and tooling

- [x] package.json, tsconfig, next.config, eslint, prettier, gitignore, env example
- [x] Install dependencies, dev server, /api/health, lint/typecheck/build
- [x] Config, clock, logger, error foundation

## Phase 3 — Design tokens and UI foundation

- [x] Tokens, typography, focus ring, reduced motion
- [x] Reusable components (buttons, fields, alerts, badges, cards, empty/error
      states, stepper, timeline, app shell); tabs not needed by the final screens
- [ ] Programmatic contrast check script (not run)

## Phase 4 — Database and seed

- [x] Schema, triggers, migrations
- [x] Fictional, time-relative seed and guarded reset
- [x] Constraint smoke test (TC-CONC-00, `scripts/smoke-check.ts`)

## Phase 5 — Auth and permissions

- [x] Sign-in/out, sessions, rate limiting, CSRF origin check
- [x] Central authz helpers and denied-access audit
- [x] 11 auth tests + 11 security tests
- [ ] HTTP-level 429 after 10 failed sign-ins observed

## Phase 6 — Catalogue, detail, eligibility

- [x] Search/filter/pagination API and UI
- [x] Detail, availability, eligibility panel
- [ ] Catalogue date-range filter (Planned)

## Phase 7 — Booking and conflicts

- [x] Time/validation modules
- [x] Booking creation, idempotency, limits, conflicts
- [x] Multi-process creation-race verification (20 rounds × 4 processes)
- [ ] Parallel approval race (TC-CONC-01) executed

## Phase 8 — Approval, FairShare, lifecycle

- [x] FairShare ranking and explanations
- [x] Queue, approve/reject/cancel, waitlist promotion, expiry
- [ ] Stale-approval re-check test (TC-BOOK-08)

## Phase 9 — Checkout/return

- [x] Condition reports, discrepancy incidents, late flag
- [ ] Checkout/return forms clicked in the browser (API verified)

## Phase 10 — Incidents, Passport, audit

- [x] Incident lifecycle and visibility
- [x] Resource Passport role-filtered timeline
- [x] Audit writer and admin views
- [ ] Passport page clicked in the browser (API verified)

## Phase 11 — Admin

- [x] Resource create/edit/status, owner assignment
- [x] User tags/suspension routes and admin audit page
- [ ] Admin user/tag/suspension behaviour tested or clicked
- [ ] Admin resource forms clicked in the browser

## Phase 12 — UI states, accessibility, responsive

- [x] Loading/empty/error/success/permission-denied states
- [x] 360 px responsive checks (15/15) and screenshots
- [ ] axe automated scan
- [ ] Full keyboard-only journey (ACC-02)
- [ ] Contrast script (ACC-03)
- [ ] Touch-target measurement at 360 px
- [ ] Reduced-motion behaviour verified in a browser

## Phase 13 — Test suite

- [x] Unit/integration tests (130/130)
- [x] Multi-process concurrency (40/40 rounds)
- [x] HTTP smoke (14/14)
- [x] Demo D1–D12 (28/28)
- [x] UI click-through UI-01/03/06 (8/8)
- [x] Typecheck, lint, production build
- [ ] UI-02/04/05 click-through
- [ ] Fresh-clone SMOKE-01
- [ ] Double-seed determinism (SMOKE-02)

## Phase 14 — Security review

- [x] SEC-01..12 walkthrough documented
- [x] Dependency audit (0 vulnerabilities)
- [x] Secret scan / ignore check
- [ ] Tests for XSS escaping, audit metadata minimization, every-endpoint 401

## Phase 15 — Demo flow

- [x] Seed rehearsal and verified demo run log (28/28)
- [x] Demo database reset to pristine seed after the final UI run

## Phase 16 — Documentation

- [x] README (written from actual implementation)
- [x] `docs/TEST_REPORT.md`
- [x] `docs/SECURITY_REVIEW.md`
- [x] `docs/FINAL_CHECKLIST.md`
- [x] Update assumptions, decisions and progress registers
- [x] Section 18 gate reported honestly as not fully satisfied
