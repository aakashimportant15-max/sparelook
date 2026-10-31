# Test report

All runs below were executed on **2026-10-30** in this workspace
(`C:\Users\Dell\Desktop\HACKU\ShareSpace`) on Windows 10, Node.js `v24.11.1`,
npm `11.6.2`, Next.js `16.4.3`, vitest `5.0.5`, better-sqlite3 `13.0.3`.
No test is marked passed unless it was actually executed and observed to pass.

## 1. Summary of executed runs

| #   | Layer                                 | Command                                       | Result                                                                                              | Evidence                                                                    |
| --- | ------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Unit + integration                    | `npm test`                                    | **130 passed / 130** in 15 files                                                                    | console output; section 2                                                   |
| 2   | Multi-process concurrency             | `npm run test:concurrency`                    | **40 / 40 rounds passed** (20 conflict + 20 idempotency, 4 processes per round)                     | console output; section 3                                                   |
| 3   | Type check                            | `npm run typecheck`                           | **Passed**, 0 errors                                                                                | console output                                                              |
| 4   | Lint                                  | `npm run lint`                                | **Passed**, 0 errors / 0 warnings                                                                   | console output                                                              |
| 5   | Production build                      | `npm run build`                               | **Passed** (1 non-fatal Turbopack tracing warning)                                                  | `docs/evidence/build.log`                                                   |
| 6   | HTTP smoke                            | `npx tsx scripts/smoke-http.ts`               | **14 / 14 checks passed**                                                                           | `docs/evidence/smoke-http.txt`                                              |
| 7   | Demo script D1–D12 over HTTP          | `npx tsx scripts/demo-run.ts`                 | **28 / 28 steps passed**                                                                            | `docs/evidence/demo-run.md`                                                 |
| 8   | Responsive / basic a11y browser check | `npx tsx scripts/browser-check.ts`            | **15 / 15 checks passed** at 360×800                                                                | `docs/evidence/browser-check.md` (screenshots in `docs/evidence/*-360.png`) |
| 9   | UI click-through (headless Chrome)    | `npx tsx scripts/ui-journey.ts`               | **8 / 8 steps passed**                                                                              | `docs/evidence/ui-journey.md` (screenshots `ui-*.png`)                      |
| 10  | Dependency audit                      | `npm audit --omit=dev`                        | **0 vulnerabilities**                                                                               | console output                                                              |
| 11  | Secret / ignore check                 | `git check-ignore -v .env data/sharespace.db` | `.env` and `*.db` ignored; no commit exists yet                                                     | console output                                                              |
| 12  | DB trigger smoke (TC-CONC-00)         | `npx tsx scripts/smoke-check.ts`              | **3 / 3**: overlap => `BOOKING_CONFLICT`, adjacent => inserted, audit delete => `AUDIT_APPEND_ONLY` | console output; writes ignored `data/smoke-check.db`                        |
| 13  | Formatting                            | `npm run format:check`                        | **Passed** after applying Prettier to the repository                                                | console output                                                              |

Prerequisites for runs 6–9: a production server started with `npm start` on
`http://localhost:3000` against a freshly seeded database, and
`DEMO_USER_PASSWORD` present in the git-ignored `.env`. Scripts never print the
password.

## 2. Vitest detail (run 1)

`npm test` output:

```
Test Files  15 passed (15)
     Tests  130 passed (130)
```

One environment note: the "Isolate 15 workers spawned" line is vitest's default
per-file isolation. It is informational, not a failure.

| File                                       | Tests   |
| ------------------------------------------ | ------- |
| `tests/unit/time.test.ts`                  | 8       |
| `tests/unit/validation.test.ts`            | 9       |
| `tests/unit/state-machine.test.ts`         | 6       |
| `tests/unit/eligibility.test.ts`           | 6       |
| `tests/unit/fairshare.test.ts`             | 7       |
| `tests/integration/database.test.ts`       | 7       |
| `tests/integration/auth.test.ts`           | 11      |
| `tests/integration/catalogue.test.ts`      | 6       |
| `tests/integration/bookings.test.ts`       | 18      |
| `tests/integration/waitlist.test.ts`       | 5       |
| `tests/integration/handover.test.ts`       | 12      |
| `tests/integration/incidents.test.ts`      | 10      |
| `tests/integration/audit-passport.test.ts` | 7       |
| `tests/integration/admin.test.ts`          | 7       |
| `tests/integration/security.test.ts`       | 11      |
| **Total**                                  | **130** |

Each test uses a controlled clock or explicit `now` values, and a dedicated
SQLite file under the OS temp directory; no run touches `data/sharespace.db`.

## 3. Concurrency detail (run 2)

`npm run test:concurrency` starts 4 independent Node processes per round against
a throwaway SQLite database:

- `TC-CONC-A` (20 rounds): four different borrowers request the same slot on the
  auto-approve resource `r05`; each round produced exactly **1 APPROVED** and
  **3 `BOOKING_CONFLICT`** responses.
- `TC-CONC-B` (20 rounds): four processes replay the same `Idempotency-Key` for
  one borrower; each round produced one booking id and exactly one stored row.

This is stronger than the guide's two-process wording, but it covers creation
races, not a parallel **approve** race (see section 6).

## 4. Guide test-case mapping

Status values: **Pass** = executed and observed to pass; **Partial** = some
acceptance points verified, others not; **Not Verified** = no executed evidence.

### AUTH

| Guide case                                            | Actual coverage                                                                                                                                                                                                              | Status                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| TC-AUTH-01 valid sign-in, cookie flags, `/api/me`     | `TC-AUTH-01` (hashed session token), smoke check "demo sign-in" + "authenticated /api/me"; cookie is `httpOnly`, `SameSite=Lax`, `secure` only when `APP_ORIGIN` is https (code review, `src/app/api/auth/sign-in/route.ts`) | Pass                          |
| TC-AUTH-02 wrong password and unknown email identical | `TC-AUTH-02`; HTTP smoke "wrong password rejected" returns 401 `UNAUTHENTICATED` with "Email or password is incorrect."                                                                                                      | Pass                          |
| TC-AUTH-03 suspended sign-in blocked                  | `TC-AUTH-03`                                                                                                                                                                                                                 | Pass                          |
| TC-AUTH-04 sign-out then `/api/me` 401                | `TC-AUTH-05` + HTTP smoke "sign-out invalidates session"                                                                                                                                                                     | Pass                          |
| TC-AUTH-05 11 failed sign-ins => 429                  | `TC-AUTH-10` tests the in-memory limiter; the HTTP route applies it (`rateLimit(key, 10, 15 min)`), but no HTTP-level 429 was executed                                                                                       | Partial / Not Verified (HTTP) |

### SECURITY / PERMISSIONS / TENANT

| Guide case                                                 | Actual coverage                                                                                                     | Status                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| TC-SEC-01 borrower approve => 403 + DENIED audit           | `TC-SEC-03` (service), `TC-SEC-09` (denial audited), demo D12 HTTP 403                                              | Pass                       |
| TC-SEC-02 foreign booking => 404                           | `TC-SEC-04`, smoke "other requester booking hidden" (404), demo D12                                                 | Pass                       |
| TC-SEC-03 owner of A approves B => 403/404                 | `TC-SEC-06` + `TC-SEC-10` (role/ownership scoping at service layer)                                                 | Pass (service level)       |
| TC-SEC-04 cross-institution access => 404 / no leakage     | `TC-SEC-01` with a second seeded institution; `TC-AUD-04` for audit scoping                                         | Pass                       |
| TC-SEC-05 `<script>` purpose renders as text               | Not executed; React escapes text by default but no test asserts it                                                  | **Not Verified**           |
| TC-SEC-06 PATCH role/institution/owner fields ignored/422  | `TC-SEC-07` verifies owners cannot change administrator-only fields; owner reassignment is admin-only (`TC-ADM-07`) | Partial                    |
| TC-SEC-07 every non-public endpoint without session => 401 | Only `/api/me` was hit without a session in the smoke script; route list not iterated                               | **Partial / Not Verified** |

### CATALOGUE / ELIGIBILITY / TIME / VALIDATION

| Guide case                                                             | Actual coverage                                                                                                                                                                                    | Status                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| TC-CAT-01 search "camera", active only                                 | `TC-CAT-01`, `TC-CAT-03`; demo D2 "search camera"                                                                                                                                                  | Pass                  |
| TC-CAT-02 MAINTENANCE visible with badge, request disabled             | `TC-CAT-01` includes maintenance resources; request blocking is enforced by eligibility (`TC-ELIG-02`, `TC-BOOK-06`). UI badge screenshot at 360px. No test asserts the disabled control attribute | Partial               |
| TC-CAT-03 DISABLED/ARCHIVED hidden from borrowers, visible to admin    | `TC-CAT-01`, `TC-SEC-08`, `TC-PASS-03`                                                                                                                                                             | Pass                  |
| TC-CAT-04 no matches => empty state with clear-filters                 | Page renders an empty state (`src/app/catalogue/page.tsx`), but no browser test for the no-results path                                                                                            | **Not Verified** (UI) |
| TC-ELIG-01..04 eligible / missing group / missing training / suspended | `TC-ELIG-01`..`04`; demo D6 returns 422 with `MISSING_GROUP, MISSING_TRAINING`; `TC-BOOK-06`                                                                                                       | Pass                  |
| TC-ELIG-05 maintenance => RESOURCE_UNAVAILABLE                         | `TC-ELIG-02` (inactive resource blocked), `TC-BOOK-06` resource availability                                                                                                                       | Pass                  |
| TC-ELIG-06 UI hint equals server booking check                         | Both UI and booking use the same eligibility service, but equality is not asserted by a test; UI-01 only checks the copy                                                                           | **Not Verified**      |
| TC-TIME-01..08                                                         | `TC-TIME-01`..`08`, `TC-VALID-01`..`09` (half-open, END_BEFORE_START, past, short/long, >30 days, granularity, multiple errors)                                                                    | Pass                  |

### BOOKING / STATE / WAITLIST

| Guide case                                                 | Actual coverage                                                                                                                              | Status                                                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| TC-BOOK-01 PENDING + history + audit                       | `TC-BOOK-02`, `TC-AUD-02`; demo D3                                                                                                           | Pass                                                                                                                             |
| TC-BOOK-02 auto-approve                                    | `TC-BOOK-01`; demo D7                                                                                                                        | Pass                                                                                                                             |
| TC-BOOK-03 overlap APPROVED => 409, no row                 | `TC-BOOK-04`, `TC-DB-01`; demo D4 409 (no row check is at unit test level)                                                                   | Pass                                                                                                                             |
| TC-BOOK-04 overlapping PENDING allowed                     | `TC-DB-03`, `TC-BOOK-05`                                                                                                                     | Pass                                                                                                                             |
| TC-BOOK-05 idempotency replay                              | `TC-BOOK-03`; concurrency round B                                                                                                            | Pass                                                                                                                             |
| TC-BOOK-06 4th open booking blocked                        | `TC-BOOK-08`                                                                                                                                 | Pass                                                                                                                             |
| TC-BOOK-07 rank-1 approval                                 | `TC-BOOK-09`; demo D5                                                                                                                        | Pass                                                                                                                             |
| TC-BOOK-08 user suspended after request, approve re-checks | No test                                                                                                                                      | **Not Verified**                                                                                                                 |
| TC-BOOK-09 owner approves own request => 403               | Self-booking is blocked at creation (`TC-BOOK-06`, `SELF_BOOKING`); approval of a self-created request is unreachable, but no dedicated test | Partial                                                                                                                          |
| TC-BOOK-10 rank-2 requires override                        | `TC-BOOK-10`; demo D11 (422 `OVERRIDE_REQUIRED`, then 200 with reason)                                                                       | Pass                                                                                                                             |
| TC-BOOK-11 competitors become WAITLISTED                   | `TC-BOOK-09`, `TC-AUD-02`; demo D11                                                                                                          | Pass                                                                                                                             |
| TC-BOOK-12 reject reason                                   | `TC-BOOK-12`; demo D5                                                                                                                        | Pass                                                                                                                             |
| TC-STATE-01..06                                            | `TC-STATE-01`..`06`; `TC-BOOK-15` (expiry); `OVERDUE` is derived in UI/API, no stored status                                                 | Partial: STATE-04 actor/reason/timestamp is covered by history assertions (`TC-AUD-02`) rather than one dedicated test           |
| TC-WAIT-01..05                                             | `TC-WAIT-01`..`05`, `TC-BOOK-05`; `TC-WAIT-03` covers skipped ineligible candidates                                                          | Pass (TC-WAIT-05 "past start => EXPIRED" is covered indirectly by expiry tests, not a dedicated waitlist-expiry test => Partial) |

### CONCURRENCY

| Guide case                                                | Actual coverage                                                                                                               | Status                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| TC-CONC-00 DB smoke (overlap fails, adjacent succeeds)    | `npx tsx scripts/smoke-check.ts` (direct inserts) plus `TC-DB-01`, `TC-DB-02`, `TC-DB-03`                                     | Pass                         |
| TC-CONC-01 two approvals in parallel (20 rounds)          | **Not executed.** The DB trigger rejects a second overlapping APPROVED row (`TC-DB-02`), but no parallel approve race was run | **Not Verified**             |
| TC-CONC-02 two creations on auto-approve slot (20 rounds) | `npm run test:concurrency` conflict rounds, 4 processes × 20 rounds                                                           | Pass (stronger worker count) |

### FAIRSHARE

| Guide case                                   | Actual coverage                                                            | Status  |
| -------------------------------------------- | -------------------------------------------------------------------------- | ------- |
| TC-FS-01 lower 30-day usage ranks higher     | `TC-FS-01`; demo D11                                                       | Pass    |
| TC-FS-02 earlier created_at wins tie         | `TC-FS-01`                                                                 | Pass    |
| TC-FS-03 lower booking id wins full tie      | `TC-FS-02`                                                                 | Pass    |
| TC-FS-04 older than 30 days excluded         | `TC-FS-01` (usage window fixture)                                          | Pass    |
| TC-FS-05 only CHECKED_OUT/RETURNED count     | `TC-FS-01`/`TC-FS-05`                                                      | Pass    |
| TC-FS-06 open-bookings boundary              | `TC-BOOK-08`, `TC-ELIG-05`                                                 | Pass    |
| TC-FS-07 weekly hours boundary, Monday week  | `TC-ELIG-05`, `TC-TIME-07`                                                 | Pass    |
| TC-FS-08 explanation has no other identities | `TC-FS-06`                                                                 | Pass    |
| TC-FS-09 determinism under shuffled input    | `TC-FS-04` verifies repeated-call determinism, not shuffled input ordering | Partial |
| TC-FS-10 override iff rank > 1               | `TC-FS-07`, `TC-BOOK-10`                                                   | Pass    |

### HANDOVER / INCIDENTS / AUDIT / PASSPORT / ADMIN

| Guide case                                                                                        | Actual coverage                                                                                                                                  | Status                                                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| TC-HAND-01..10                                                                                    | `TC-HAND-01`..`12` (window, duplicate checkout, approved-only, manager-only, discrepancy, missing item, late return)                             | Pass                                                                                           |
| TC-INC-01..06                                                                                     | `TC-INC-01`..`10`, `TC-SEC-05` (incident visibility), `TC-INC-06` (admin-only reopen)                                                            | Pass (TC-INC-04 owner reopen rejection + admin reopen is split across `TC-INC-04`/`TC-INC-06`) |
| TC-AUD-01 expected events                                                                         | `TC-AUD-01`, `TC-AUD-02`                                                                                                                         | Pass                                                                                           |
| TC-AUD-02 metadata carries no secrets                                                             | Not asserted by a test; manual review: audit metadata contains ids, roles, ranks, reason codes and status values only                            | **Not Verified** (manual review only)                                                          |
| TC-AUD-03 append-only                                                                             | `TC-AUD-03` (UPDATE/DELETE rejected by triggers), `TC-DB-07`                                                                                     | Pass                                                                                           |
| TC-AUD-04 denied attempts logged DENIED                                                           | `TC-SEC-09`                                                                                                                                      | Pass                                                                                           |
| TC-PASS-01..03                                                                                    | `TC-PASS-01`..`03`; demo D10                                                                                                                     | Pass                                                                                           |
| TC-ADM-01 create resource appears in catalogue                                                    | `TC-ADM-01`; demo D1                                                                                                                             | Pass                                                                                           |
| TC-ADM-02 owner/borrower create => 403                                                            | `TC-ADM-03`, `TC-SEC-06`                                                                                                                         | Pass                                                                                           |
| TC-ADM-03 MAINTENANCE blocks new requests                                                         | `TC-BOOK-06` eligibility/availability path; no dedicated MAINTENANCE 422 test                                                                    | Partial                                                                                        |
| TC-ADM-04 archive hidden, history intact                                                          | `TC-CAT-01` (archived hidden), `TC-PASS-03` (admin sees archived passport)                                                                       | Partial                                                                                        |
| TC-ADM-05 affected future bookings reported                                                       | `TC-ADM-05` (disable reports affected bookings)                                                                                                  | Pass                                                                                           |
| TC-ADM-06..08 tags change eligibility, suspend blocks sign-in/invalidates sessions, audit filters | No tests. Routes exist (`src/app/api/admin/users/[id]/tags`, `.../status`, `src/app/api/admin/audit`), but their behaviour and UI are unverified | **Not Verified**                                                                               |

### UI / E2E

| Guide case                                 | Actual coverage                                                                                                                     | Status                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| UI-01 request => PENDING                   | `scripts/ui-journey.ts` steps 1–4 (real headless Chrome, form submission, detail page)                                              | Pass                  |
| UI-02 conflict message and waitlist option | Not clicked; demo D4 verifies the API 409 and message text only                                                                     | **Not Verified** (UI) |
| UI-03 approve / reject in owner queue      | Approve path clicked and verified (steps 5–7). Override dialog and reject path were not clicked in the UI (verified via API D5/D11) | Partial               |
| UI-04 checkout/return forms + incident     | Not clicked; verified via API demo D7–D9                                                                                            | **Not Verified** (UI) |
| UI-05 passport timeline differs by role    | Not clicked; verified via API demo D10 and screenshots at 360px for other pages                                                     | **Not Verified** (UI) |
| UI-06 permission denied                    | `scripts/ui-journey.ts` step 8 (borrower redirected to `/forbidden`)                                                                | Pass                  |

### RESPONSIVE / ACCESSIBILITY / SMOKE

| Guide case                              | Actual coverage                                                                                                                                                                                                                                                                         | Status                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| RESP-01 no horizontal scroll at 360px   | `scripts/browser-check.ts` 8 pages, page-level `scrollWidth <= innerWidth`; touch-target ≥44px not measured                                                                                                                                                                             | Partial                           |
| ACC-01 axe scan                         | Not run (no axe dependency installed)                                                                                                                                                                                                                                                   | **Not Run**                       |
| ACC-02 keyboard-only complete journey   | Only Tab order on the catalogue was recorded; full keyboard booking/approve journey not completed                                                                                                                                                                                       | **Not Verified**                  |
| ACC-03 contrast script                  | Not run; palette reviewed manually only                                                                                                                                                                                                                                                 | **Not Verified**                  |
| ACC-04 form errors announced            | Sign-in error: `role=alert`, `aria-describedby`, focus moved to error, verified at 360px                                                                                                                                                                                                | Partial (other forms not checked) |
| ACC-05 reduced motion respected         | CSS includes a `prefers-reduced-motion` block; no automated/manual verification recorded                                                                                                                                                                                                | **Not Verified**                  |
| SMOKE-01 clean setup                    | Install/dependencies already present; `npm run db:reset && npm run db:migrate && npm run db:seed`, `npm run build`, `npm start`, `/api/health`, sign-in, catalogue, and smoke checks all executed in this workspace. A fresh `git clone` + `npm ci` was not possible (no commit exists) | Partial                           |
| SMOKE-02 double seed => identical state | Not executed. Seeded timestamps are relative to the seed time by design, so byte-identical files are not expected; row/ID equality was not compared                                                                                                                                     | **Not Run**                       |

## 5. Failures observed during phase 13 and their causes

| Failing check                                        | Cause                                                                                          | Resolution                                                                | Final state                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| 360px sign-in squeezed into two columns              | Inline `gridTemplateColumns` overrode the max-width media query                                | Removed the inline style, kept the stylesheet rule                        | Fixed; `signin-360.png`                        |
| Mobile header nav clipped to 57 px                   | `.main-nav` `flex: 1` overrode the media query width                                           | Added `flex: 0 0 100%` at ≤720px                                          | Fixed; browser check "mobile header nav strip" |
| Smoke wrong-password expectation                     | Test expected `INVALID_CREDENTIALS`; the HTTP route intentionally maps to `UNAUTHENTICATED`    | Corrected the assertion to the real contract                              | Fixed; 14/14                                   |
| Demo-run bookings all 422                            | `Idempotency-Key` header was missing                                                           | Added the header helper and unique keys per step                          | Fixed; 28/28                                   |
| Demo D4 adjacent slot 422                            | The computed slot ended after R01's 20:00 closing time                                         | Moved the non-overlapping request to a valid next-day slot                | Fixed; 28/28                                   |
| Demo D11 checked a different booking                 | It read Ananya's R01 booking instead of her R02 request                                        | Selected the R02 booking by requester id                                  | Fixed; 28/28                                   |
| Seed APPROVED R01 booking outside opening hours      | `nextQuarter(now) + 4h` could cross 20:00 or midnight                                          | Clamped the seed slot to 10:00–14:00 when out of hours                    | Fixed; 130/130 after change                    |
| UI journey timeout on submit                         | Selector `form button[type=submit]` matched the header sign-out form                           | Scoped to `form:has(#purpose) button[type="submit"]`                      | Fixed; 8/8                                     |
| UI-01 PENDING assertion failed                       | Page renders the badge as uppercase `PENDING`; assertion was case-sensitive                    | Made the assertion case-insensitive                                       | Fixed; 8/8                                     |
| `npm run typecheck` error in `scripts/ui-journey.ts` | `PASSWORD` narrowed after a module-level throw was still `string \| undefined` inside `main()` | Typed the constant as `string` with an empty fallback, retained the guard | Fixed; typecheck clean                         |
| `npm run lint` unused `localStamp`                   | Dead helper left in `scripts/demo-run.ts`                                                      | Removed the helper                                                        | Fixed; lint clean                              |

No test was deleted or weakened to make a run pass, except the case-only fix to
the UI assertion, which corrected a wrong expectation rather than the product
behaviour (the screenshot shows the correct page).

## 6. Known gaps and honesty notes

- **Route handlers vs services.** Most integration tests exercise services and
  repositories directly. The Next.js route wrappers that use `next/headers`
  (`withApi`, cookie parsing) are covered only by the HTTP smoke, demo and UI
  scripts, not by unit tests. This is a deliberate trade-off to keep tests
  fast and free of Next.js request-context mocking.
- **`TC-CONC-01` (parallel approvals)** was not run. The database trigger is
  tested synchronously (`TC-DB-02`), but a true two-process approve race is
  unverified.
- **UI-02/04/05** were not clicked; the corresponding server behaviour is
  covered by the API demo run.
- **Axe, contrast and full keyboard journey** were not executed.
- **HTTP 429**, **suspended-after-request approval**, **tag edit affecting
  eligibility**, **user suspension UI**, and **audit-page filters** are not
  verified.
- **SMOKE-01** was executed from an already-installed workspace, not from a
  fresh clone. **SMOKE-02** was not run.
- The production build prints one Turbopack warning: `src/db/client.ts:11`
  resolves the configured DB path with `path.resolve(process.cwd(), ...)`,
  which makes Turbopack trace the whole project. It does not fail the build;
  it makes the build trace larger. Disclosed in the README limitations.
- Demo/test data is fictional and labelled as such. The demo password lives
  only in git-ignored `.env`; no real secret is committed.

## 7. Final hardening re-verification — 2026-10-31

Workspace: `C:\Users\Dell\Desktop\HACKU\SpareLook` on Windows 10,
Node.js `v24.18.0`, Next.js `16.4.3`, vitest `5.0.5`, better-sqlite3 `13.0.3`.
Sections 1–6 above are the original 2026-10-30 run; this section records the
later hardening pass. No earlier result was overwritten or counted twice.

| #   | Layer                         | Command                                         | Result                                              |
| --- | ----------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| 1   | Unit + integration            | `npm test`                                      | **141 passed / 141** in 16 files                    |
| 2   | Multi-process concurrency     | `npm run test:concurrency`                      | **40 / 40 rounds passed** (4 processes per round)   |
| 3   | Type check                    | `npm run typecheck`                             | **Passed**, 0 errors                                |
| 4   | Lint                          | `npm run lint`                                  | **Passed**, 0 errors                                |
| 5   | Production build              | `npm run build`                                 | **Passed** (same non-fatal Turbopack trace warning) |
| 6   | Playwright E2E, lifecycle     | `npx playwright test specs/06-*.spec.ts`        | **10 / 10 passed**                                  |
| 7   | Playwright E2E, redesign/flow | `npx playwright test specs/07-redesign.spec.ts` | **11 / 11 passed** after the selector fix below     |

The E2E runs used the isolated database `data/uitest.db`
(`SHARESPACE_DB_PATH=./data/uitest.db`), a production server on port 3000, and
the git-ignored `DEMO_USER_PASSWORD`. The script never printed the password.
Spec 06 ran first (it mutates data), then the database was reset and re-seeded
before spec 07.

### New and extended tests

- `tests/integration/waitlist-position.test.ts` (new, 6 cases, TC-WAITP-01..06):
  live rank/total, usage tie-break, leaving the list, non-overlapping requests,
  authorization and seeded ordering.
- `TC-FS-08` — waitlist explanation wording uses only implemented rules.
- `TC-BOOK-19` — cancelling an approved booking frees the slot for a new
  approved booking.
- `TC-INC-11` — manager-visible incident status history from the audit trail;
  reporters see no staff history.
- `TC-DB-08` — seed contains pending/approved/waitlisted/checked-out/returned
  bookings, a checkout report and waitlist history.

### Failure investigated and fixed (test code, not app behaviour)

`RD-03` failed once with a Playwright strict-mode violation:
`.alert.alert-success[role=status]` matched **two** legitimate success alerts on
the resource page (eligibility status + booking confirmation). The booking had
succeeded; the assertion was ambiguous. The spec now scopes the assertion to
the "Request a booking" region. The product was not changed. An earlier
sign-out selector in the same harness was corrected the same way.

### Pre-existing environment issue (disclosed, not an app failure)

The workspace contains untracked flattened review copies under
`SpareLook_Review_Files/`. TypeScript matched those `.tsx` copies and reported
`TS2307: Cannot find module './actions'`. `tsconfig.json` and
`eslint.config.mjs` now exclude that folder; no application source was changed
for this. Typecheck and lint are clean with the exclusion.

`npm run format:check` reports style drift in 26 pre-existing files
(user-supplied prompt/review copies, generated `scr/` reports and earlier
redesign files). Files changed in this pass were formatted; no repo-wide
reformat was applied.

### Still not verified (unchanged)

axe/contrast, full keyboard-only journey, HTTP 429, parallel approve race
(TC-CONC-01), fresh-clone SMOKE-01, double-seed SMOKE-02, and visual review
beyond the captured screenshots. These remain gaps, not passes.
