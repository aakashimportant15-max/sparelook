# SpareLook

SpareLook is a **fictional, single-institution demo** of a camera and technical
equipment sharing platform. It covers one complete lifecycle: catalogue →
eligibility → conflict-free booking request → owner approval / waitlist →
checkout condition report → return condition report → incident → resource
history (Resource Passport) → audit trail.

> Every institution, person, email address, asset tag and booking in this build
> is **fictional sample data**. `@riverbend-demo.example` is a reserved,
> non-routable domain. No real person or institution is represented.

**Honesty note:** no `README.md` existed in the workspace when work started
(reconnaissance on 2026-10-30 found only the supplied prompt). This file was
written after implementation and describes only what exists in the repository
and what was actually executed. The labels below follow the guide's vocabulary:
**Implemented** (exists and verified with recorded evidence), **Partially
Implemented**, **Planned**, **Not Verified**.

## Problem statement and target audience

**Problem.** Small institutions (departments, clubs, labs) share expensive
equipment through spreadsheets, chat threads and paper sign-out sheets. The
same failures repeat: double bookings are discovered at pickup, eligibility
rules are applied inconsistently, condition and damage history is lost, and
there is no fair, auditable way to choose between competing requests.

**Focused use case.** SpareLook models **one institution** sharing camera and
technical equipment. It covers the full loop — catalogue → eligibility →
conflict-free request → owner decision / waitlist → checkout condition report →
return condition report → incident → resource history — with server-side
authorization and an append-only audit trail.

**Target audience.**

- **Borrowers** (students/club members) who need to discover eligible equipment and book it without conflicts.
- **Owners/managers** (staff responsible for equipment) who approve requests, run check-in/check-out, and handle incidents.
- **Institution admins** who manage the catalogue, users and audit trail.

The build is a **fictional single-institution demo** for evaluation; it is not
deployed and contains no real institution or person.

## Status at a glance

| Area                                                                 | Status                | Evidence                                                      |
| -------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------- |
| Sign-in / sign-out, server-side sessions, session expiry             | Implemented           | `npm test` (TC-AUTH-01..11), HTTP smoke, UI journey           |
| Role and tenant authorization (server-side)                          | Implemented           | `npm test` (TC-SEC-01..11), demo D12                          |
| Catalogue with search, type/location/eligibility filters, pagination | Implemented           | `npm test` (TC-CAT-01..06), demo D2                           |
| Resource detail, availability, eligibility explanation               | Implemented           | TC-CAT-06, TC-ELIG-01..06, UI-01                              |
| Booking request, validation, idempotency, limits                     | Implemented           | `npm test` (TC-BOOK-01..19, TC-VALID, TC-TIME)                |
| Conflict prevention (DB triggers + `BEGIN IMMEDIATE`)                | Implemented           | TC-DB-01..07, TC-BOOK-19, 40 process-race rounds              |
| Approval / rejection with reasons                                    | Implemented           | TC-BOOK-09..12, demo D5, UI-03                                |
| FairShare ranking and override requirement                           | Implemented           | TC-FS-01..08, demo D11                                        |
| Waitlist and promotion                                               | Implemented           | TC-WAIT-01..05, TC-WAITP-01..06, screenshot 05                |
| Live waitlist position and rule-based explanation                    | Implemented           | TC-WAITP-01..06, TC-FS-08, screenshot 05                      |
| Booking status timeline (real timestamps/history)                    | Implemented           | TC-BOOK/TC-HAND history checks, screenshot 04                 |
| Checkout / return condition reports, discrepancy detection           | Implemented           | TC-HAND-01..12, demo D7–D8, screenshot 07                     |
| Incidents, status lifecycle and manager-visible status history       | Implemented           | TC-INC-01..11, demo D9, screenshot 08                         |
| Resource Passport (role-filtered history)                            | Implemented           | TC-PASS-01..03, demo D10                                      |
| Append-only audit trail and admin audit page                         | Implemented           | TC-AUD-01..04, demo D1/D10                                    |
| Admin resource create/edit/status/owner assignment                   | Implemented           | TC-ADM-01..07, demo D1                                        |
| Seed data covering pending/approved/waitlisted/active/returned       | Implemented           | TC-DB-08, `npm run demo:reset`                                |
| Admin user tags / suspension / audit filters                         | Partially Implemented | Routes and UI exist; no test and no click-through recorded    |
| Admin user tags / suspension / audit filters                         | Partially Implemented | Routes and UI exist; no test and no click-through recorded    |
| Catalogue date-range availability filter                             | Planned               | Not built; availability is shown on resource detail           |
| Photo/attachment evidence for condition reports                      | Planned               | Conditions + accessory checklist + notes only                 |
| Browser UI journeys UI-02/04/05, axe scan, full keyboard journey     | Not Verified          | See `docs/TEST_REPORT.md` section 6                           |
| AI Resource Matchmaker                                               | Not Implemented       | Deliberately out of MVP scope; see "AI and external services" |

## Screenshots (fictional demo data)

Final judge-facing screenshots are in **`docs/screenshots/important-pages/`**.
They are real 1440×900 captures from the production build running against the
isolated demo database (captured 2026-10-31), with animations disabled and no
loading or error states. No passwords, tokens or real personal data are visible;
all names and emails are synthetic (`@riverbend-demo.example`).

| File                        | Page                                            |
| --------------------------- | ----------------------------------------------- |
| `01-home.png`               | Public landing page                             |
| `02-resource-discovery.png` | Catalogue with search/category filters          |
| `03-resource-details.png`   | Resource detail, eligibility and request form   |
| `04-booking-status.png`     | Booking detail with progress/status timeline    |
| `05-fairshare-waitlist.png` | Live waitlist position and rule explanation     |
| `06-owner-dashboard.png`    | Owner request queue with FairShare ranking      |
| `07-checkin-return.png`     | Checkout evidence and return condition workflow |
| `08-incident-history.png`   | Incident detail with manager-visible history    |
| `09-admin-dashboard.png`    | Admin resource management table                 |

Older 360 px and headless-Chrome evidence remains under `docs/evidence/`.

## Stack (as built)

| Layer            | Choice                                             | Version            |
| ---------------- | -------------------------------------------------- | ------------------ |
| Runtime          | Node.js                                            | 24.11.1 (detected) |
| Package manager  | npm                                                | 11.6.2             |
| Framework        | Next.js App Router (Turbopack)                     | 16.4.3             |
| UI               | React                                              | 19.3.1             |
| Language         | TypeScript strict                                  | 5.9.2              |
| Database         | SQLite via better-sqlite3 (WAL, `BEGIN IMMEDIATE`) | 13.0.3             |
| Validation       | Zod                                                | 4.6.7              |
| Password hashing | bcryptjs                                           | 3.0.3              |
| Icons            | lucide-react                                       | 1.65.0             |
| Tests            | vitest                                             | 5.0.5              |
| Script runner    | tsx                                                | 4.23.15            |

PostgreSQL was the guide's preferred database. It was not used because Docker
was not running and no local `psql` was available; the guide explicitly allows
the SQLite fallback (BR-05b). Race-safety claims are limited to what the
multi-process test verifies. See `docs/DECISIONS.md`.

## Architecture

```
Browser / API client
        │
        ▼
Next.js App Router pages + route handlers (src/app)
        │  withApi(): origin check, session, role gate, request id, denial audit
        ▼
Services (src/server/services)  ── domain rules (src/domain: eligibility,
        │                           validation, FairShare, state machine)
        ▼
Repositories (src/server/repos) + audit/auth/session helpers (src/server)
        │
        ▼
SQLite (src/db/schema.sql): FKs, CHECKs, overlap trigger, append-only triggers
```

Domain rules are pure functions where possible; all timestamps are stored in
UTC and converted with the institution time zone (`Asia/Kolkata` by default).
Writes that can race use `BEGIN IMMEDIATE`; the database also rejects
overlapping `APPROVED`/`CHECKED_OUT` bookings for the same resource.

## Directory tree (real, trimmed)

```
.
├── src
│   ├── app                 pages, route handlers, server actions, global CSS
│   ├── components          forms, badges, navigation, timeline/stepper UI
│   ├── db                  schema.sql, migrations, seed data, reset/migrate
│   ├── domain              policy, eligibility, validation, FairShare, booking machine
│   ├── lib                 config, API wrapper, errors, schemas, time, logger
│   └── server              auth, authz, sessions, audit, rate limit, services, repos
├── scripts
│   ├── smoke-check.ts      direct DB trigger smoke (TC-CONC-00)
│   ├── smoke-http.ts       read-only HTTP smoke over a running server
│   ├── demo-run.ts         D1–D12 over the real HTTP API
│   ├── browser-check.ts    headless Chrome 360×800 checks + screenshots
│   └── ui-journey.ts       headless Chrome click-through UI-01/03/06
├── tests
│   ├── unit                pure domain tests
│   ├── integration         services + database tests
│   ├── concurrency         multi-process race harness
│   └── helpers             temp-database fixtures
├── docs
│   ├── ASSUMPTIONS.md, DECISIONS.md, PROGRESS.md, TASKS.md
│   ├── TEST_REPORT.md, FINAL_CHECKLIST.md, SECURITY_REVIEW.md
│   ├── evidence            run logs and screenshots
│   └── screenshots/important-pages   final 1440×900 page screenshots
├── scr
│   └── _harness            Playwright E2E harness (runs on isolated DB)
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Setup and run (commands actually executed)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create local environment file**

   ```bash
   cp .env.example .env
   # then set DEMO_USER_PASSWORD in .env (never commit .env)
   ```

3. **Create the database, apply the schema and seed fictional data**

   ```bash
   npm run demo:reset      # db:reset && db:migrate && db:seed
   ```

4. **Run in development**

   ```bash
   npm run dev             # http://localhost:3000
   ```

   **Or build and run the production server**

   ```bash
   npm run build
   npm start
   ```

5. **Health check**

   ```bash
   curl http://localhost:3000/api/health
   ```

Resetting re-anchors all relative demo dates to the current day:

```bash
npm run demo:reset
```

`npm run db:reset` refuses to delete a database outside `./data` or the OS temp
directory unless `CONFIRM_DB_RESET=yes` is set, and refuses to run when
`NODE_ENV=production`.

### Database setup and migrations

- **Schema:** `src/db/schema.sql` is applied by `npm run db:migrate`. It uses
  `CREATE TABLE IF NOT EXISTS` / `CREATE TRIGGER IF NOT EXISTS`, so running it
  again is safe, and it records `user_version = 1`. There is no multi-file
  migration history yet; schema changes are made directly in this file for the
  demo.
- **Seed:** `npm run db:seed` writes synthetic data from
  `src/db/seed-data.ts`. Relative dates are re-anchored to the current day. The
  seed is idempotent: if the demo institution already exists it exits without
  changing data, so re-seeding requires `npm run db:reset` first. It covers
  pending, approved, waitlisted, checked-out, returned and incident states.
- **Isolated databases:** tests and screenshots use a separate file, e.g.

  ```bash
  SHARESPACE_DB_PATH=./data/uitest.db npm run db:reset
  SHARESPACE_DB_PATH=./data/uitest.db npm run db:migrate
  SHARESPACE_DB_PATH=./data/uitest.db npm run db:seed
  ```

  `SHARESPACE_DB_PATH` overrides `./data/sharespace.db`; the reset guard only
  permits local files under `./data` or the OS temp directory.

- **Integrity guards:** foreign keys and CHECK constraints are enabled in
  `src/db/client.ts`; overlap triggers reject conflicting `APPROVED`/
  `CHECKED_OUT` bookings, and append-only triggers protect audit, booking,
  report and incident rows from UPDATE/DELETE.

### Environment variables

| Name                     | Purpose                                                 | Default                 |
| ------------------------ | ------------------------------------------------------- | ----------------------- |
| `SHARESPACE_DB_PATH`     | SQLite file path                                        | `./data/sharespace.db`  |
| `INSTITUTION_TIMEZONE`   | IANA zone for input/display                             | `Asia/Kolkata`          |
| `SESSION_IDLE_HOURS`     | Session idle timeout                                    | `8`                     |
| `SESSION_ABSOLUTE_HOURS` | Session absolute lifetime                               | `24`                    |
| `DEMO_USER_PASSWORD`     | Password for all seeded demo accounts (local only)      | empty                   |
| `APP_ORIGIN`             | Allowed origin for CSRF checks and cookie `Secure` flag | `http://localhost:3000` |

If `DEMO_USER_PASSWORD` is empty, the seed script generates one and prints it
once to the local console. The password is never shown in the UI and is never
committed.

## Demo accounts (fictional)

| Name          | Email                           | Role                                           |
| ------------- | ------------------------------- | ---------------------------------------------- |
| Meera Iyer    | `meera@riverbend-demo.example`  | ADMIN                                          |
| Dr. Kabir Rao | `kabir@riverbend-demo.example`  | OWNER (camera + audio)                         |
| Nikhil Shah   | `nikhil@riverbend-demo.example` | OWNER (test equipment)                         |
| Ananya Das    | `ananya@riverbend-demo.example` | BORROWER (media-club, camera-safety)           |
| Rohan Mehta   | `rohan@riverbend-demo.example`  | BORROWER (media-club, camera-safety)           |
| Isha Kulkarni | `isha@riverbend-demo.example`   | BORROWER (film-dept, camera + drone safety)    |
| Dev Malhotra  | `dev@riverbend-demo.example`    | BORROWER (no group/training — ineligible demo) |
| Sana Qureshi  | `sana@riverbend-demo.example`   | BORROWER (media-club; seeded heavy usage)      |

All accounts use the single password from `DEMO_USER_PASSWORD`. In the test
database a second institution and user exist only to prove tenant isolation.

## User roles and permissions

Authorization is enforced in the service and route layers (`src/server/authz.ts`,
`withApi`), not only by hiding UI controls. Foreign or out-of-scope rows return
**404** rather than confirming existence; denied sensitive attempts are audited.

| Capability                                         | Borrower                     | Owner                        | Admin |
| -------------------------------------------------- | ---------------------------- | ---------------------------- | ----- |
| Browse catalogue and see own eligibility           | Yes                          | Yes                          | Yes   |
| Request a booking; cancel own booking              | Yes                          | Yes (as a borrower)          | Yes   |
| View own bookings and booking timeline             | Yes                          | Yes                          | Yes   |
| See live waitlist position / explanation           | Own request only             | For resources they manage    | Yes   |
| Approve / reject / override (`/manage/requests`)   | No (403/404)                 | Own resources only           | Yes   |
| Checkout / return condition reports                | Own approved booking         | Own resources only           | Yes   |
| Report an incident                                 | Own booking only             | Own resources                | Yes   |
| Manage incident status and see status history      | No                           | Own resources only           | Yes   |
| Read full Resource Passport                        | Limited summary              | Own resources                | Yes   |
| `/admin/resources`, `/admin/users`, `/admin/audit` | No (403 + `/forbidden`)      | No                           | Yes   |
| Cross-institution data                             | Filtered by institution; 404 | Filtered by institution; 404 | Same  |

Navigation hides links a role cannot use, but every action is re-checked on the
server. `tests/integration/security.test.ts` (TC-SEC-01..11) covers role,
ownership and IDOR cases, including changing booking/resource IDs.

## Judge access and demo setup

There are **no published credentials**. The judge sets the demo password
locally; the seed hashes it with bcrypt and never commits or prints it when
`DEMO_USER_PASSWORD` is set.

```bash
npm install
cp .env.example .env          # set DEMO_USER_PASSWORD=<your local choice>
npm run demo:reset            # schema + synthetic seed (pending/approved/waitlisted/active/returned + incident)
npm run build && npm start    # http://localhost:3000
```

Sign in with any demo email from the table above and that local password.
Suggested judge walkthrough:

1. Landing page → sign in as **Ananya** (borrower).
2. Catalogue → resource **R01**; observe eligibility, availability and the
   live waitlist note.
3. **My bookings** → open a booking for the status timeline; open the
   waitlisted booking to see its real position and explanation.
4. Sign in as **Kabir** (owner) → `/manage/requests` → approve/checkout/return.
5. Open **Incidents** → an incident detail as Kabir shows the status history.
6. Sign in as **Meera** (admin) → `/admin/resources`, `/admin/users`,
   `/admin/audit`.
7. Sign in as **Dev** to see the ineligible-borrower path.

Seeding writes only to the configured `SHARESPACE_DB_PATH` (default
`./data/sharespace.db`) and only after the reset guard passes. It never touches
any other database or real user data.

## Demo flow (D1–D12)

The API demo script (`npx tsx scripts/demo-run.ts`) executes all twelve steps
against the running server with six personas and records every result in
`docs/evidence/demo-run.md` (28/28 steps passed on 2026-10-30). Summary:

1. **D1** Admin creates "Wireless Lavalier Mic Set" and it appears in the catalogue with an audit event.
2. **D2** Ananya searches "camera" and sees eligibility for R01.
3. **D3** Ananya requests R01 → `PENDING`, owner queue grows.
4. **D4** Rohan requests an overlapping window → 409 with no identities; a non-overlapping slot is accepted.
5. **D5** Kabir approves Ananya's request and rejects Rohan's with a reason visible to the requester.
6. **D6** Dev is blocked with `MISSING_GROUP` and `MISSING_TRAINING`.
7. **D7** The auto-approve lavalier kit is booked and checked out with a `GOOD` condition report.
8. **D8** Return records `MINOR_WEAR` + a missing battery → `RETURNED`, discrepancy flagged, `MISSING_ITEM` incident created.
9. **D9** Kabir moves the incident `OPEN → INVESTIGATING → RESOLVED`; the borrower sees it.
10. **D10** Owner sees the full R01 Passport; a borrower sees a limited summary and only their own bookings.
11. **D11** R02 queue ranks Ananya #1 and Sana #2; approving Sana requires an override reason; Ananya becomes `WAITLISTED`.
12. **D12** Rohan gets 403/404 from owner/admin APIs and is redirected to `/forbidden` in the UI.

Run it only on a freshly seeded database, then reset:

```bash
npm run demo:reset
npm start                     # in another terminal
npx tsx scripts/demo-run.ts
npm run demo:reset
```

D7–D9 run on the auto-approve resource created in D1 because the seeded R01
booking occupies a slot outside the 30-minute checkout window. This deviation
from the literal demo script is recorded in `docs/DECISIONS.md` and the demo
evidence.

## Policy defaults (assumptions, single place: `src/domain/policy.ts`)

| Rule                                | Value                                               |
| ----------------------------------- | --------------------------------------------------- |
| Booking granularity                 | 15 minutes                                          |
| Minimum duration                    | 60 minutes                                          |
| Maximum advance                     | 30 days                                             |
| Default per-resource maximum        | 72 hours                                            |
| Open bookings per member            | 3                                                   |
| Waitlist entries per member         | 2                                                   |
| Booked hours per Monday–Sunday week | 24                                                  |
| FairShare usage window              | last 30 days                                        |
| Checkout window                     | opens 30 min before start, closes after booking end |
| Late return grace                   | 15 minutes after end                                |
| Missed pickup / no-show threshold   | 60 minutes after start                              |
| Override reason length              | 10–300 characters                                   |
| Reject/cancel reason length         | 5–300 characters                                    |
| Purpose length                      | 3–300 characters                                    |
| Condition report notes              | up to 1000 characters                               |

These are configurable defaults, not institutional policy; see
`docs/ASSUMPTIONS.md` for the owner decisions still open.

## API overview

All non-public routes require the session cookie. Booking creation also requires
an `Idempotency-Key` header (8–100 characters).

| Group       | Routes                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth        | `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, `GET /api/me`                                                                                                                         |
| Catalogue   | `GET /api/resources`, `GET /api/resources/:id`, `GET /api/resources/:id/availability`, `GET /api/resources/:id/eligibility`, `GET /api/resources/:id/passport`                             |
| Bookings    | `GET/POST /api/bookings`, `GET /api/bookings/:id`, `POST .../approve`, `.../reject`, `.../cancel`, `.../checkout`, `.../return`                                                            |
| Owner queue | `GET /api/manage/requests`                                                                                                                                                                 |
| Incidents   | `GET/POST /api/incidents`, `GET /api/incidents/:id`, `PATCH /api/incidents/:id/status`                                                                                                     |
| Admin       | `GET/POST/PATCH /api/resources`, `PATCH /api/resources/:id/status`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/tags`, `PATCH /api/admin/users/:id/status`, `GET /api/admin/audit` |
| Health      | `GET /api/health`                                                                                                                                                                          |

## Tests and verification

Full details, per-case mapping and gaps are in **`docs/TEST_REPORT.md`**.

| Command                                | Result (latest recorded run)                                    |
| -------------------------------------- | --------------------------------------------------------------- |
| `npm test`                             | **141 / 141 tests passed** (16 files) — 2026-10-31              |
| `npm run test:concurrency`             | **40 / 40 rounds passed** (4 processes each) — 2026-10-31       |
| `npm run typecheck`                    | **Passed**, 0 errors — 2026-10-31                               |
| `npm run lint`                         | **Passed**, 0 errors — 2026-10-31                               |
| `npm run format:check`                 | Passed — 2026-10-30                                             |
| `npm run build`                        | **Passed** (1 non-fatal Turbopack tracing warning) — 2026-10-31 |
| Playwright `specs/06-*.spec.ts`        | **10 / 10 passed** — 2026-10-31                                 |
| Playwright `specs/07-redesign.spec.ts` | **11 / 11 passed** — 2026-10-31                                 |
| `npx tsx scripts/smoke-check.ts`       | 3 / 3 DB trigger checks — 2026-10-30                            |
| `npx tsx scripts/smoke-http.ts`        | 14 / 14 HTTP checks — 2026-10-30                                |
| `npx tsx scripts/demo-run.ts`          | 28 / 28 demo steps (D1–D12) — 2026-10-30                        |
| `npx tsx scripts/browser-check.ts`     | 15 / 15 checks at 360×800 — 2026-10-30                          |
| `npx tsx scripts/ui-journey.ts`        | 8 / 8 click-through steps — 2026-10-30                          |
| `npm audit --omit=dev`                 | 0 vulnerabilities — 2026-10-30                                  |

The Playwright harness lives in `scr/_harness` (not part of `npm test`). It runs
against a production server on the isolated demo database:

```bash
SHARESPACE_DB_PATH=./data/uitest.db npm run db:reset
SHARESPACE_DB_PATH=./data/uitest.db npm run db:migrate
SHARESPACE_DB_PATH=./data/uitest.db npm run db:seed
SHARESPACE_DB_PATH=./data/uitest.db PORT=3000 npm start
cd scr/_harness && npx playwright test specs/07-redesign.spec.ts
```

Note: the workspace contains untracked flattened review copies under
`SpareLook_Review_Files/`; `tsconfig.json` and `eslint.config.mjs` exclude that
folder so typecheck/lint reflect the application source only. This exclusion is
disclosed rather than silently deleting the user's files.

`npm run format:check` currently reports style drift in 26 pre-existing files
(user-supplied prompt/review copies, generated `scr/` reports and earlier
redesign files). Files changed in this hardening pass were formatted; a
repo-wide reformat was deliberately not applied to avoid unrelated diffs.

Not run / not verified: axe automated scan, contrast script, full keyboard-only
journey, UI click-through for conflict/waitlist, checkout/return forms and
Passport, HTTP-level 429, parallel approve race (TC-CONC-01), fresh-clone
SMOKE-01 and double-seed SMOKE-02. These are listed as gaps, not silently
counted as passes.

## Security and privacy notes

A fuller walkthrough is in **`docs/SECURITY_REVIEW.md`**. Highlights:

- Session tokens are random 256-bit values; only a SHA-256 hash is stored. The
  cookie is `httpOnly`, `SameSite=Lax`, and `Secure` when the app origin is https.
- Sign-out revokes the server-side session; suspension can revoke all sessions.
- Authorization is enforced in the service/route layer, not only in the UI.
  Cross-institution rows are filtered by `institution_id`; foreign bookings
  return 404 rather than confirming existence.
- Denied sensitive attempts are written to the audit trail.
- Mutation requests carrying an `Origin` header are checked against
  `APP_ORIGIN`/the request origin.
- Validation uses Zod; SQL uses bound parameters throughout.
- Audit rows are protected by database triggers against UPDATE/DELETE, but this
  is **not cryptographic tamper-proofing**; anyone with write access to the
  SQLite file can alter it.
- No real secrets are committed. `.env` is git-ignored; `.env.example` contains
  placeholders only. `npm audit --omit=dev` reported 0 vulnerabilities.

## Known limitations

- **Single-institution demo.** The schema carries `institution_id` and tenant
  isolation is tested, but there is no institution-management UI.
- **SQLite, single process.** Correctness under process races is verified at
  demo scale; this is not a production-scale concurrency claim.
- **No photo evidence.** Condition reports use structured conditions, an
  accessory checklist and notes. Image upload is not implemented.
- **No automated consequences** for late returns or damage; incidents and flags
  are recorded for humans to act on.
- **No notifications**, password reset, self-service account creation, or
  email delivery.
- **Date-range catalogue filter is absent.** Availability is shown on resource
  detail pages.
- **Rate limiting is in-memory and per process**, keyed by email + IP.
- **CSRF check is origin-based and only applies when an `Origin` header is
  present**; non-browser clients without the header are not blocked by this
  check (they still need a session cookie).
- **Route handlers are covered by script-level HTTP tests**, not unit tests that
  mock `next/headers`.
- **Accessibility is partially verified.** Sign-in error announcement and basic
  tab order were checked; no axe/contrast run and no complete keyboard journey.
- **Build warning.** Turbopack traces the project because the database path is
  resolved from the working directory (`src/db/client.ts`). Benign for the
  demo; it increases build trace size.
- **Demo data is time-relative.** Re-running `npm run demo:reset` changes
  absolute dates by design.

## AI and external services

**No AI is integrated.** The AI Resource Matchmaker is a future/optional idea
and is not represented as implemented. Search and filtering are deterministic
keyword/field filters. FairShare ranking is deterministic. No external API, paid
service, analytics, telemetry or cloud storage is used by the application.

**Build process disclosure.** An AI coding assistant (Qoder) was used to
implement, test and document this repository. It did not generate the visual
artwork: `background.png` was supplied by the project owner/brief and is used
unmodified (also copied to `public/background.png`). No stock images, icon
packs or component templates were added beyond the libraries below.

Third-party libraries: Next.js, React, better-sqlite3, Zod, bcryptjs,
lucide-react. Development tooling: TypeScript, vitest, tsx, ESLint, Prettier.
No CSS framework or component template was used; styles are hand-written CSS.
Icons are rendered with the ISC-licensed `lucide-react` package.

## Project placeholders (not provided)

These items were **not supplied** and are deliberately left unresolved rather
than invented:

- Team members and individual contributions — **not provided**.
- License — **not decided**.
- Public repository URL — **not provided** (a local `git init` exists; no
  commit or remote was created by the agent).
- Deployment URL — **none**; no external deployment was performed.
- Official hackathon rules, judging weights, deadlines and submission process —
  **Not Verified** (no official source in the workspace).

## Related documents

- `docs/TEST_REPORT.md` — every executed run, counts, failures, per-case mapping and gaps.
- `docs/SECURITY_REVIEW.md` — control-by-control security walkthrough and limitations.
- `docs/FINAL_CHECKLIST.md` — Completed / Verified / Pending / Unverified.
- `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/TASKS.md`.
- `docs/evidence/` — demo, smoke, browser and UI run logs plus screenshots.
