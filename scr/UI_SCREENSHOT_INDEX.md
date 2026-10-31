# ShareSpace — UI Screenshot Index

Final coherent run: **2026-10-30 18:38:56Z → 18:40:17Z** (IST 2026-10-31 00:08–00:10).
All captures below are from that run and were taken at the moment each scenario's assertion passed.

- **58 final-run files** (`211`–`268`), each with a valid PNG signature.
- **50 primary captures** — one per scenario row in `UI_TEST_RESULTS.csv`.
- **8 supporting captures** — additional states inside the same scenario (marked *supporting*; not a separate result row).
- All results are **PASS**. Viewports: **D** 1440×900, **T** 768×1024, **M** 360×800; measured widths match in every case.
- Files `001`–`210` pre-date this run (earlier iterations and failure diagnostics). They were preserved untouched but are **not** final-run evidence; see §3.

Paths are relative to `scr/`.

---

## 1. Final run — 211 to 268

| # | File | Scenario | Viewport | Type | What it shows |
| --- | --- | --- | --- | --- | --- |
| 211 | `screenshots/211-UI-AUTH-01-signin-initial-d.png` | UI-AUTH-01 | D | primary | Sign-in page: heading, labelled email/password, demo-account list, no password values |
| 212 | `screenshots/212-UI-AUTH-01M-signin-mobile-m360.png` | UI-AUTH-01M | M | primary | Sign-in at 360×800; no horizontal overflow |
| 213 | `screenshots/213-UI-AUTH-02-empty-submit-d.png` | UI-AUTH-02 | D | primary | Empty submit: form-level alert, focus moved to it, no per-field messages |
| 214 | `screenshots/214-UI-AUTH-03-invalid-credentials-d.png` | UI-AUTH-03 | D | primary | Generic invalid-credentials error; email preserved |
| 215 | `screenshots/215-UI-AUTH-04A-borrower-landing-d.png` | UI-AUTH-04A | D | primary | Borrower landing + nav (Catalogue, My bookings, Incidents) |
| 216 | `screenshots/216-UI-AUTH-04B-owner-landing-d.png` | UI-AUTH-04B | D | primary | Owner landing + Requests nav, no admin-only links |
| 217 | `screenshots/217-UI-AUTH-04C-admin-landing-d.png` | UI-AUTH-04C | D | primary | Admin nav including Resources, Members, Audit |
| 218 | `screenshots/218-UI-AUTH-05-signed-out-d.png` | UI-AUTH-05 | D | primary | Signed-out banner on `/sign-in?signedOut=1`, navigation removed |
| 219 | `screenshots/219-UI-AUTH-06-protected-redirect-d.png` | UI-AUTH-06 | D | primary | Protected route redirect with `next=` return path |
| 220 | `screenshots/220-UI-AUTH-07-back-after-signout-d.png` | UI-AUTH-07 | D | primary | Back after sign-out lands on sign-in, no protected content |
| 221 | `screenshots/221-UI-AUTH-08-rate-limited-d.png` | UI-AUTH-08 | D | primary | HTTP 429 after ten failed attempts (throwaway email) |
| 222 | `screenshots/222-UI-BOR-01-catalogue-d.png` | UI-BOR-01 | D | primary | Catalogue: 9 visible resources, archived hidden, maintenance visible, filters |
| 223 | `screenshots/223-UI-BOR-01M-catalogue-mobile-m360.png` | UI-BOR-01M | M | primary | Full catalogue at 360×800; no horizontal overflow |
| 224 | `screenshots/224-UI-BOR-02-search-match-d.png` | UI-BOR-02 | D | supporting | Search match state (empty state is the primary capture) |
| 225 | `screenshots/225-UI-BOR-02-search-empty-d.png` | UI-BOR-02 | D | primary | No-match empty state with recovery link |
| 226 | `screenshots/226-UI-BOR-03-eligible-filter-d.png` | UI-BOR-03 | D | primary | Eligible-only filter (5 of 9); single page, no pagination control |
| 227 | `screenshots/227-UI-BOR-04-resource-detail-d.png` | UI-BOR-04 | D | primary | Resource detail: description, accessories, eligibility, availability, passport link, request form |
| 228 | `screenshots/228-UI-BOR-05-ineligible-d.png` | UI-BOR-05 | D | primary | Ineligible member: plain-language reasons, submit disabled |
| 229 | `screenshots/229-UI-BOR-06-maintenance-detail-d.png` | UI-BOR-06 | D | supporting | Maintenance resource detail (checkout blocked) |
| 230 | `screenshots/230-UI-BOR-06-archived-404-d.png` | UI-BOR-06 | D | primary | Archived resource renders not-found UI (HTTP 200 — finding F1) |
| 231 | `screenshots/231-UI-BOR-07-validation-end-before-start-d.png` | UI-BOR-07 | D | supporting | Booking form validation: end-before-start and required purpose |
| 232 | `screenshots/232-UI-BOR-07-booking-approved-d.png` | UI-BOR-07 | D | primary | Valid request auto-approved; booking reference saved |
| 233 | `screenshots/233-UI-BOR-08-conflict-d.png` | UI-BOR-08 | D | primary | 409 conflict with conflicting window and waitlist guidance |
| 234 | `screenshots/234-UI-BOR-09-waitlisted-d.png` | UI-BOR-09 | D | primary | Waitlist booking detail (WAITLISTED explanation) |
| 235 | `screenshots/235-UI-BOR-10-single-booking-d.png` | UI-BOR-10 | D | primary | Exactly one booking row after a synchronous double submit |
| 236 | `screenshots/236-UI-OWN-01-queue-d.png` | UI-OWN-01 | D | primary | Owner queue: two competing requests, ranks, 30-day usage, eligibility |
| 237 | `screenshots/237-UI-OWN-02-rejected-detail-d.png` | UI-OWN-02 | D | primary | Rejected request detail with the reason; removed from queue |
| 238 | `screenshots/238-UI-OWN-03-isha-pending-d.png` | UI-OWN-03 | D | primary | Second borrower (7.0 h usage) joins as rank 2 behind 30.0 h |
| 239 | `screenshots/239-UI-OWN-04-override-dialog-d.png` | UI-OWN-04 | D | supporting | Override-required error and mandatory reason field |
| 240 | `screenshots/240-UI-OWN-04-queue-cleared-d.png` | UI-OWN-04 | D | primary | Rank-1 approval completed; queue cleared, competitor waitlisted |
| 241 | `screenshots/241-UI-OWN-05-superseded-waitlist-d.png` | UI-OWN-05 | D | primary | Superseded request in WAITLISTED state with explanation (finding F5) |
| 242 | `screenshots/242-UI-OWN-06-booking-cancelled-d.png` | UI-OWN-06 | D | supporting | Borrower cancellation recorded with reason |
| 243 | `screenshots/243-UI-OWN-06-rohan-promoted-d.png` | UI-OWN-06 | D | primary | Waitlisted request auto-promoted to APPROVED after cancellation |
| 244 | `screenshots/244-UI-OWN-07-returned-detail-d.png` | UI-OWN-07 | D | primary | Handover history, MINOR_WEAR return, missing-plate evidence, auto MISSING_ITEM incident |
| 245 | `screenshots/245-UI-OWN-08-checkout-early-d.png` | UI-OWN-08 | D | primary | Checkout outside the 30-minute window rejected; no data written |
| 246 | `screenshots/246-UI-INC-01-manual-incident-d.png` | UI-INC-01 | D | primary | Manually reported incident linked to the existing booking |
| 247 | `screenshots/247-UI-INC-02-resolved-d.png` | UI-INC-02 | D | primary | Incident OPEN → INVESTIGATING → RESOLVED with resolution note |
| 248 | `screenshots/248-UI-INC-03-incident-readonly-d.png` | UI-INC-03 | D | primary | Borrower read-only incident view; no status controls |
| 249 | `screenshots/249-UI-INC-04-incident-list-d.png` | UI-INC-04 | D | primary | Borrower incident list showing both involved incidents |
| 250 | `screenshots/250-UI-PAS-01-passport-owner-d.png` | UI-PAS-01 | D | primary | Owner passport: full condition/audit timeline |
| 251 | `screenshots/251-UI-PAS-02-passport-borrower-d.png` | UI-PAS-02 | D | primary | Borrower passport: summary banner, own events only, no audit detail |
| 252 | `screenshots/252-UI-ADM-01-resource-admin-list-d.png` | UI-ADM-01 | D | primary | Admin resource list incl. archived and maintenance resources |
| 253 | `screenshots/253-UI-ADM-02-duplicate-tag-d.png` | UI-ADM-02 | D | supporting | Duplicate asset tag rejected with a field error |
| 254 | `screenshots/254-UI-ADM-02-created-resource-d.png` | UI-ADM-02 | D | primary | Resource created with a unique tag |
| 255 | `screenshots/255-UI-ADM-03-maintenance-status-d.png` | UI-ADM-03 | D | primary | Resource moved to MAINTENANCE; booking blocked |
| 256 | `screenshots/256-UI-ADM-04-tags-granted-d.png` | UI-ADM-04 | D | supporting | Group/training tags granted to the member |
| 257 | `screenshots/257-UI-ADM-04-dev-now-eligible-d.png` | UI-ADM-04 | D | supporting | Eligibility updated live for the previously ineligible member |
| 258 | `screenshots/258-UI-ADM-04-tags-restored-d.png` | UI-ADM-04 | D | primary | Tags restored to the seeded state after the check |
| 259 | `screenshots/259-UI-ADM-05-member-status-d.png` | UI-ADM-05 | D | primary | Suspended badge/Reactivate state; session revoked (finding F2) |
| 260 | `screenshots/260-UI-ADM-06-audit-filter-d.png` | UI-ADM-06 | D | primary | Audit filter returning only `booking.approved` events |
| 261 | `screenshots/261-UI-ADM-07-forbidden-owner-d.png` | UI-ADM-07 | D | primary | Owner redirected to `/forbidden` for admin member management |
| 262 | `screenshots/262-UI-ADM-08-forbidden-borrower-d.png` | UI-ADM-08 | D | primary | Borrower redirected to the 403 page for the owner queue |
| 263 | `screenshots/263-UI-RES-01-bookings-mobile-m360.png` | UI-RES-01 | M | primary | Borrower bookings at 360×800; no horizontal overflow |
| 264 | `screenshots/264-UI-RES-02-queue-mobile-m360.png` | UI-RES-02 | M | primary | Owner queue at 360×800; no horizontal overflow |
| 265 | `screenshots/265-UI-RES-03-queue-tablet-t.png` | UI-RES-03 | T | primary | Owner queue at 768×1024; no horizontal overflow |
| 266 | `screenshots/266-UI-A11Y-01-semantics-d.png` | UI-A11Y-01 | D | primary | Catalogue after semantic checks: one h1, labelled controls, labelled nav, skip link |
| 267 | `screenshots/267-UI-A11Y-02-skip-link-focus-d.png` | UI-A11Y-02 | D | primary | Skip link focused; next Tab lands inside `#main-content` |
| 268 | `screenshots/268-UI-A11Y-03-keyboard-signin-d.png` | UI-A11Y-03 | D | primary | Signed-in catalogue after keyboard-only sign-in |

---

## 2. Mapping to result rows

The CSV's `screenshot_path` column points to the **primary** capture for each of the 50 scenarios. Supporting captures above are extra states from the same scenario and inherit that scenario's PASS result. `UI_TEST_RESULTS.csv` and `UI_TEST_REPORT.md` are the authoritative result records.

---

## 3. Earlier captures (001–210) — retained, not final evidence

- These files pre-date the final run and cover harness bring-up, exploratory checks, and failed/partial iterations (for example `020-UI-BOR-06-failure-d.png`).
- A few early auth captures (`026`–`029`) are 1280×720 because the browser viewport override was fixed after that iteration; the final-run equivalents (`211`–`214`) are 1440×900 and supersede them.
- Per the preservation rule, nothing was overwritten or deleted. Treat 001–210 as diagnostic history only; use 211–268 for final evidence.
- Earlier run logs are retained as `scr/_harness/out/results-run1.jsonl` … `results-run5.jsonl`.

---

## 4. Validation record

- PNG signature (`89 50 4E 47 0D 0A 1A 0A`) verified for all 58 final-run files.
- Width check: D = 1440, T = 768, M = 360 — 0 mismatches.
- All 50 CSV paths exist; test IDs unique; numbering continuous 1–268 with no gaps.
- No credential/token patterns in CSV notes or result records; no session files remain.
