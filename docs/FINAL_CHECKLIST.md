# Final checklist

Date: **2026-10-30**. This checklist does not claim that the submission is
complete. Section 18 of the guide is **not fully satisfied** because several
critical criteria are only partially verified (see the gate table below).

## Completed (implemented)

- [x] Next.js 16 App Router app with strict TypeScript, ESLint, Prettier, vitest.
- [x] SQLite schema with foreign keys, CHECK constraints, booking-overlap trigger,
      append-only audit triggers, unique idempotency key and booking history.
- [x] Fictional, time-relative seed data (8 users, 10 resources, history,
      incidents, future approved booking, competing R02 requests, heavy-usage
      borrower for FairShare).
- [x] Sign-in/sign-out with hashed passwords, hashed session tokens, idle/absolute
      expiry, generic errors and suspension handling.
- [x] Central API wrapper with origin check, deny-by-default session gate, role
      gate, request ids and denial auditing.
- [x] Catalogue, search, filters, pagination, resource detail, availability and
      eligibility explanations.
- [x] Booking creation with Zod validation, policy limits, idempotency, status
      history, audit, database-level conflict prevention.
- [x] Owner queue, approve/reject/cancel, FairShare ranking and override reasons,
      superseding competitors, waitlist and promotion, lazy expiry.
- [x] Checkout/return condition reports, checklist, discrepancy detection, late
      flag, automatic incidents and incident lifecycle.
- [x] Resource Passport with role-filtered timeline and audit view.
- [x] Admin resource create/edit/status/owner reassignment; admin users and audit
      pages (UI present; see Unverified).
- [x] Loading, error, not-found, forbidden and empty states; 360 px responsive
      fixes for sign-in and navigation.
- [x] Registers: assumptions, decisions, progress, tasks, test report, security
      review, evidence folder.

## Verified (with evidence)

| Item                                                    | Evidence                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| 130 unit/integration tests pass                         | `docs/TEST_REPORT.md` §2 (`npm test`, 15 files)                       |
| 40/40 concurrency rounds (creation races + idempotency) | `docs/TEST_REPORT.md` §3 (`npm run test:concurrency`)                 |
| DB trigger smoke: overlap, adjacency, append-only       | `docs/TEST_REPORT.md` §1 run 12 (`scripts/smoke-check.ts`)            |
| Typecheck and lint clean                                | `npm run typecheck`, `npm run lint` on 2026-10-30                     |
| Production build succeeds                               | `docs/evidence/build.log` (`npm run build`, 1 warning)                |
| HTTP smoke 14/14                                        | `docs/evidence/smoke-http.txt`                                        |
| Demo D1–D12 28/28                                       | `docs/evidence/demo-run.md`                                           |
| 360 px checks 15/15                                     | `docs/evidence/browser-check.md`, `*-360.png`                         |
| UI click-through 8/8 (UI-01, UI-03 approve, UI-06)      | `docs/evidence/ui-journey.md`, `ui-*.png`                             |
| Dependency audit clean                                  | `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities             |
| No secret in repository                                 | `.env` git-ignored, `.env.example` placeholders, text scan, no commit |
| Tenant isolation and role permissions                   | `TC-SEC-01..11`, demo D12                                             |
| FairShare ranking and override                          | `TC-FS-01..07`, demo D11                                              |
| Passport role filtering                                 | `TC-PASS-01..03`, demo D10                                            |
| Append-only audit at DB level                           | `TC-AUD-03`, `TC-DB-07`                                               |
| Responsive sign-in error announcement                   | `browser-check.md` sign-in error row                                  |

## Pending (exists but incomplete, or not built)

- [ ] Full admin UI verification (tags, suspension, audit filters) and tests for
      `src/app/api/admin/users/*`.
- [ ] Catalogue date-range availability filter.
- [ ] Image evidence for condition reports.
- [ ] Automated consequences for late returns/damage (policy decision).
- [ ] Production deployment / HTTPS setup.
- [ ] Team members, contributions, license, repository URL, deployment URL
      (owner input required).
- [ ] Official hackathon rules, judging weights, deadline and submission process
      (no official source in the workspace).

## Unverified / not run

- [ ] axe automated accessibility scan (ACC-01).
- [ ] Contrast script on design tokens (ACC-03).
- [ ] Full keyboard-only journey: sign-in, booking, approve with override
      (ACC-02); only catalogue tab order was checked.
- [ ] UI click-through for conflict/waitlist (UI-02), checkout/return (UI-04) and
      Passport timeline (UI-05); these were verified only through the API demo.
- [ ] Parallel **approve** race (TC-CONC-01); DB trigger is tested synchronously.
- [ ] HTTP-level 429 after 10 failed sign-ins (limiter unit-tested only).
- [ ] Suspended-after-request approval re-check (TC-BOOK-08).
- [ ] XSS rendering test for `<script>` in purpose/notes (TC-SEC-05).
- [ ] Every non-public endpoint without a session returns 401 (TC-SEC-07).
- [ ] Double-seed determinism (SMOKE-02).
- [ ] Fresh-clone clean install (SMOKE-01 was run from an installed workspace,
      not a fresh `git clone` + `npm ci`).
- [ ] Touch-target ≥44 px measurement at 360 px.
- [ ] Reduced-motion behaviour verified in a browser.
- [ ] Audit metadata no-secrets test (manual review only).
- [ ] Owner/admin UI forms clicked beyond page render (resource create/edit,
      user tags/suspension).

## Section 18 acceptance gate (honest status)

| #   | Criterion                                            | Status      | Notes                                                                                                                      |
| --- | ---------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clean setup works (SMOKE-01)                         | **Partial** | install → migrate → seed → build → start → health → sign-in → catalogue executed in this workspace; not from a fresh clone |
| 2   | D1–D12 works end-to-end with run log                 | **Pass**    | 28/28, `docs/evidence/demo-run.md`                                                                                         |
| 3   | Conflict tests incl. TC-CONC-01/02                   | **Partial** | TC-CONC-02 pass at 4 processes × 20 rounds; TC-CONC-01 parallel approval **Not Verified**                                  |
| 4   | Permissions enforced server-side (TC-SEC suite)      | **Partial** | TC-SEC-01..11 pass at service level; TC-SEC-05 and every-endpoint-401 not verified                                         |
| 5   | No dead primary actions (click-through recorded)     | **Partial** | UI-01/03/06 clicked; UI-02/04/05 not clicked                                                                               |
| 6   | Loading/empty/error/success/permission-denied states | **Partial** | Implemented and partially rendered; not all states manually checked                                                        |
| 7   | Core tests executed and reported honestly            | **Pass**    | 130/130 + concurrency + scripts, gaps listed                                                                               |
| 8   | No secrets committed                                 | **Pass**    | scan and ignore check; no commit exists                                                                                    |
| 9   | 360 px responsive and keyboard-accessible            | **Partial** | 360 px pass; keyboard journey incomplete                                                                                   |
| 10  | README reflects reality                              | **Pass**    | README written from actual implementation and runs                                                                         |
| 11  | Known limitations and unverified claims disclosed    | **Pass**    | README, TEST_REPORT §6, SECURITY_REVIEW                                                                                    |

**Conclusion:** the app is a working, verified demo for the scenarios above, but
the Section 18 gate is **not fully satisfied**. Do not describe it as complete or
production-ready until the Unverified items are executed and TC-CONC-01,
TC-SEC-05 and the keyboard journey are covered.
