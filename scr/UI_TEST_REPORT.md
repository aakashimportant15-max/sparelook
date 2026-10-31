# ShareSpace — UI Test Report

**Run window:** 2026-10-30 18:38:56Z → 18:40:17Z (IST 2026-10-31 00:08–00:10)
**Application:** ShareSpace (`C:\Users\Dell\Desktop\HACKU\ShareSpace`)
**Report date:** 2026-10-31
**Executed by:** automated Playwright harness at `scr/_harness` (Chromium only)

---

## 1. Overall statement

All **50 planned UI scenarios were executed in a real browser and passed their explicit assertions**: 50 PASS, 0 FAIL, 0 BLOCKED. Screenshots were captured at the moment of each assertion and are indexed in `UI_SCREENSHOT_INDEX.md`; every scenario ID maps to a capture.

This is **not a full product acceptance sign-off**. Several areas were deliberately out of scope or could not be exercised with the seeded data (pagination, axe/WCAG automation, contrast measurement, screen readers, cross-browser, concurrency beyond double-submit, load/performance). Seven product observations (F1–F7) were found and are documented below; **no product code was changed**, per the test constraints.

---

## 2. Environment under test

| Item | Value |
| --- | --- |
| OS | Windows 10.0.26300, x64 |
| Node.js | v24.11.1 |
| App server | `npm start` (`next start`), production build, `http://localhost:3000` |
| Framework | Next.js 16.4.3, React 19.3.1, TypeScript, SQLite (better-sqlite3) |
| Database | `data/uitest.db` — isolated copy of the seeded app DB |
| Browser | Playwright 1.64.1, Chromium (Desktop Chrome), `workers: 1`, `retries: 0`, timeout 120 s |
| Locale / TZ / motion | `en-GB` / `Asia/Kolkata` / `reducedMotion: reduce` |
| Viewports | D 1440×900, T 768×1024, M 360×800 |
| Data | Seeded fictional accounts (borrower, owner, second borrower, admin, ineligible member) |

Server log for the final run: `scr/_harness/logs/app-ui-20261031-005500.log`.

---

## 3. Safety and data handling

- **Isolated database.** Tests ran only against `data/uitest.db`, a byte-for-byte copy of the seeded app DB made before execution. The production DB `data/sharespace.db` was never written to.
- **Backups before execution:** `scr/_harness/backup/sharespace-20261030-233747.db` (sha1 `d4c41346…5e237f`) and `scr/_harness/backup/uitest-20261030-233747.db` (sha1 `93765526…c424256`).
- **Credentials:** the demo password was read from the git-ignored `.env` silently; it was never printed, logged, screenshot, or written to any report or CSV. Session cookies existed only in Playwright memory and transient `storageState` files, which were deleted during cleanup.
- **No external or destructive actions:** no paid services, no account creation, no deployments, no branch changes, and **no git commits or pushes**.
- **Preservation:** all pre-existing files in `scr/` were kept. Captures 001–210 from earlier iterations remain untouched; the final run wrote only new files 211–268.
- **Restore verified after the run:**
  - `data/uitest.db` restored from the backup; sha1 now matches the backup exactly (`93765526…c424256`).
  - Restored DB contains **0 UITEST bookings, 0 UITEST resources, 0 sessions**, 8 seeded users, 1 seeded incident, 0 suspended users.
  - `data/sharespace.db` sha1 matches the pre-test backup exactly (`d4c41346…5e237f`); `.env` mtime unchanged (2026-10-30 15:19).
  - Empty `states/` directory remains; no token files.

---

## 4. Method and evidence rules

- The harness (`scr/_harness`) drives the running app through the real UI. Each scenario runs inside an `execute()` wrapper that records PASS **only after an explicit assertion** (URL, heading, field error, queued row, status transition, row count, etc.) and captures a screenshot through `shot()` at that point. A failed assertion is recorded as FAIL with a fallback capture.
- Test order was arranged so each account signs in at most twice (in-memory rate limit is 10 failures / 15 min per email+IP), and FairShare fixtures were created immediately before the queue scenarios to keep rankings deterministic after the IST midnight rollover.
- Final run is a single coherent pass: `scr/_harness/out/results.jsonl` holds the 50 records (timestamps 18:38:56Z–18:40:17Z). Earlier, partially failing iterations are retained separately as `results-run1…run5.jsonl` and are not presented as final evidence.
- Browser diagnostics were collected (`out/diagnostics.jsonl`): only two expected HTTP 422s from the booking-validation scenario were observed. The server log shows only the expected `INVALID_CREDENTIALS` warnings and rate-limit rejections; **no 500s or unexpected errors**.

---

## 5. Results by phase

| Phase | Scenario IDs | Count | Result | Primary evidence (final run) |
| --- | --- | --- | --- | --- |
| A–C · Authentication | AUTH-01, 01M, 02, 03, 04A, 04B, 04C, 05, 06, 07, 08 | 11 | 11 PASS | 211–221 |
| D · Browse & borrower journeys | BOR-01, 01M, 02, 03, 04, 05, 06, 07, 08, 09, 10 | 11 | 11 PASS | 222–235 |
| D · Owner approvals & FairShare | OWN-01 … OWN-08 | 8 | 8 PASS | 236–245 |
| D · Incidents & passport | INC-01 … INC-04, PAS-01, PAS-02 | 6 | 6 PASS | 246–251 |
| D · Administration & authorisation | ADM-01 … ADM-08 | 8 | 8 PASS | 252–262 |
| E · Responsive | RES-01, RES-02, RES-03 | 3 | 3 PASS | 263–265 |
| E · Accessibility | A11Y-01, A11Y-02, A11Y-03 | 3 | 3 PASS | 266–268 |
| **Total** | | **50** | **50 PASS** | **50 primary + 8 supplementary captures** |

Highlights verified end-to-end:

- Role-based navigation and route guards; generic invalid-credential error; 429 after the 10-failure threshold; sign-out revokes access and Back does not restore content.
- Catalogue search/filter, eligibility reasons, maintenance/archived handling, booking validation, conflict (409) and waitlist creation, and single-booking behavior under a synchronous double submit.
- FairShare queue with rank + 30-day usage, required override reason, automatic waitlisting of a superseded request, and automatic promotion after cancellation.
- Checkout only inside the 30-minute window; return with condition evidence and an automatically opened `MISSING_ITEM` incident; incident lifecycle OPEN → INVESTIGATING → RESOLVED; read-only borrower incident view.
- Passport scope split (owner full timeline vs borrower summary + own events); admin resource creation after duplicate-tag rejection, status change, tag grant/restore, suspension/reactivation with session revocation, audit filter, and `/forbidden` guards for cross-role access.
- No horizontal overflow at 360×800 and 768×1024 on the layout-sensitive screens; one `h1` per page, labelled controls, labelled main nav, working skip link, and a keyboard-only sign-in.

Full per-scenario rows, notes and screenshot paths: `scr/UI_TEST_RESULTS.csv` (header `test_id,scenario,viewport,status,screenshot_path,notes`).

---

## 6. Findings (observations, not fixed)

| ID | Severity | Finding | Where | Evidence |
| --- | --- | --- | --- | --- |
| F1 | Medium | An archived resource renders the 404 page for a borrower but the HTTP response is **200** (soft 404). The route calls `notFound()` after data lookup, and the response headers appear to have already been flushed by the streamed render. Monitoring, caches or API clients can treat a missing resource as success. | `src/app/resources/[id]/page.tsx:30`; `src/server/services/resources.ts:95-99` | `230-UI-BOR-06-archived-404-d.png` |
| F2 | Low | The member status success message ("Member suspended." / reactivated) renders only inside the collapsed "Manage access" form, so an admin who suspends from the summary row gets no visible confirmation; only the badge/button changes. | `src/components/UserEditor.tsx:126-137` | `259-UI-ADM-05-member-status-d.png` |
| F3 | Low | Checkout/return success banners are unmounted by the `router.refresh()` that follows submission, so the confirmation disappears before a human can read it. The persistent status, handover evidence and related-incident section remain correct. | `src/components/BookingActions.tsx:242, 252-260`; `src/app/bookings/[id]/page.tsx:282-320` | `244-UI-OWN-07-returned-detail-d.png` |
| F4 | Medium | A return can be recorded **before the booking starts**: the return action has no time guard, while checkout correctly enforces a 30-minute window. Observed returning a 00:15–02:15 booking at 00:04. | `src/server/services/bookings.ts` (`returnBooking`, from line 707) | `244-UI-OWN-07-returned-detail-d.png`, `245-UI-OWN-08-checkout-early-d.png` |
| F5 | Low | A request automatically moved to WAITLISTED by a competing approval shows only the generic rationale "Another request for this slot was approved"; the specific supersede reason appears only in the Status history list, not in the top-level explanation. | `src/server/services/bookings.ts:310-320`; `src/app/bookings/[id]/page.tsx:90-97` | `241-UI-OWN-05-superseded-waitlist-d.png` |
| F6 | Low | Submitting the sign-in form empty shows only a form-level alert (`#signin-error`); there are no per-field messages and no field-level error styling. Keyboard focus does move to the alert. | `src/components/SignInForm.tsx:51` | `213-UI-AUTH-02-empty-submit-d.png` |
| F7 | Info / Ops | The rate limiter is in-memory and per-process: counters are not shared across replicas and are reset by a restart. Fine for a single-instance demo; insufficient as a production control. | `src/server/rate-limit.ts` | AUTH-08 (`221-…`) |

No finding invalidates a PASS: each scenario's stated UI behavior was observed. F1 is a protocol/status-code deviation recorded alongside the passing "archived resource is hidden" assertion; F4 is a business-rule asymmetry between return and checkout.

---

## 7. NOT RUN and BLOCKED

**NOT RUN (out of scope or not exercisable with this data/environment):**

1. Pagination interactions — the catalogue has 9 visible resources and renders a single page; only the boundary was verified (BOR-03: 5 of 9 filtered, no second page).
2. axe-core / WCAG 2.2 AA automated scan and color-contrast measurement.
3. Screen-reader walkthrough (NVDA/VoiceOver) and focus-order review beyond the skip link and keyboard sign-in.
4. Cross-browser/device testing — Chromium only; no Firefox, WebKit/Safari, or physical mobile devices.
5. Concurrency beyond the synchronous double-submit probe (e.g., parallel approvals, parallel checkouts).
6. Load, stress and performance profiling.
7. Notification/email, file upload, export and other sub-features not present in the seeded UI.

**BLOCKED:** none — no scenario was blocked by environment, data or access limitations.

---

## 8. Evidence validation

Checked after the final run:

- `UI_TEST_RESULTS.csv`: exact header, **50 rows**, unique test IDs, all statuses `PASS`, all referenced paths exist, 6 columns.
- **58 final-run capture files** (211–268): every file has the PNG signature; widths match the declared viewport in **100%** of cases (D=1440, T=768, M=360). 50 are primary scenario captures; 8 are supplementary supporting captures within the same scenario (224, 229, 231, 239, 242, 253, 256, 257).
- Screenshot numbering is continuous (1–268, no gaps); files 1–210 are earlier-iteration evidence and are explicitly **not** final-run evidence.
- `results.jsonl`: exactly 50 PASS records with ISO timestamps in the run window.
- No password, token, cookie, or demo-password pattern appears in the CSV notes or the harness output records.
- `UI_SCREENSHOT_INDEX.md` enumerates every final-run capture with scenario ID, viewport, role and result.

---

## 9. Cleanup verification

| Check | Result |
| --- | --- |
| Test server on :3000 stopped | Yes, port free; PID terminated |
| Session/token files removed (`out/states/*.json`, `out/state.json`) | Yes, 0 files remain |
| Test DB restored from backup | Yes; sha1 `93765526…c424256` matches backup |
| UITEST rows remaining | 0 bookings, 0 resources |
| Sessions remaining | 0 |
| Suspended users | 0 |
| Production DB untouched | sha1 `d4c41346…5e237f` matches pre-test backup |
| `.env` untouched | mtime unchanged (2026-10-30 15:19) |
| Git writes (commit/push/branch) | None |

---

## 10. Limitations

- Results apply to the seeded fictional dataset, a single Chromium build, and a local production server; they do not prove behavior under real production load or across browsers.
- Time-dependent rules (checkout window, start/end validation, ranking windows) were tested with fixed fixtures and the system clock; DST/locale edge cases were not explored.
- The rate-limit test intentionally used a throwaway email; the account lockout behavior for a real user over longer periods was not tested.
- Findings F1–F7 are documented for the team; no fixes were applied in this task.

## 11. Final checklist

- [x] Pre-existing `scr/` files and screenshots preserved (001–210 untouched; final run wrote 211–268 only)
- [x] Every scenario performed real browser interaction with an explicit assertion before PASS
- [x] Each capture linked to a scenario ID, viewport and result
- [x] Core journeys and previously untested flows prioritised (FairShare, handover/incident, passport scope, admin authorisation, responsive/a11y)
- [x] No product behavior or source changed
- [x] Isolated DB, pre-run backup, post-run restore verified
- [x] No secrets in screenshots, logs, reports or CSV
- [x] Deliverables present: `UI_TEST_REPORT.md`, `UI_TEST_RESULTS.csv`, `UI_SCREENSHOT_INDEX.md`
- [x] NOT RUN / BLOCKED reported honestly
- [ ] Full product acceptance — **cannot be claimed** on the basis of this run

## 12. Artefacts

| Path | Description |
| --- | --- |
| `scr/UI_TEST_REPORT.md` | This report |
| `scr/UI_TEST_RESULTS.csv` | 50 rows, exact required header |
| `scr/UI_SCREENSHOT_INDEX.md` | Index of final-run captures 211–268 |
| `scr/screenshots/` | All captures (1–210 earlier iterations, 211–268 final run) |
| `scr/_harness/` | Playwright config, specs, helpers, logs, results, backups |
| `scr/_harness/out/results.jsonl` | Final-run PASS records |
| `scr/_harness/backup/` | Pre-test DB backups and checksums |
