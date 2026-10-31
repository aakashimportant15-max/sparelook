# Security review notes

Review date: **2026-10-30**. Scope: this repository and the running demo on
`http://localhost:3000`. This is a **self-review of an MVP**, not a formal audit
and not a certification. Findings and gaps are stated plainly.

## Method

- Read the auth, API wrapper, authorization, service, repository and schema code.
- Ran the automated test suite, HTTP smoke, demo run and browser checks (see
  `docs/TEST_REPORT.md`).
- Ran `npm audit` and `npm audit --omit=dev` (both: 0 vulnerabilities).
- Ran `git check-ignore -v .env data/sharespace.db` and a repository text scan
  for `DEMO_USER_PASSWORD` excluding `.env`, `node_modules`, `.next` and `data`.
  The only hits are code/config references and the empty `.env.example`
  placeholder; no value is present in the repository. `.env` is git-ignored.
- No commit or push was performed by the agent, so no secret could be committed.

## Controls

### SEC-01 Authentication

**Implemented (verified).**

- Passwords are hashed with bcryptjs (cost 10, `src/server/auth.ts`). No plaintext
  password is stored.
- Sign-in failures return one generic 401 `UNAUTHENTICATED` message for wrong
  password and unknown email. A suspended account returns a neutral
  "account is not available" message.
- Session tokens are 32 random bytes (256 bits), base64url encoded; only a
  SHA-256 hash is stored in `sessions`.
- Sessions expire after 8 h idle / 24 h absolute (configurable) and expired rows
  are deleted lazily.
- Sign-out revokes the session server-side. Admin suspension revokes all sessions
  of the target user.
- Cookie: `httpOnly`, `SameSite=Lax`, `path=/`, `Secure` when `APP_ORIGIN` is
  https.
- Evidence: `TC-AUTH-01..11`, HTTP smoke (sign-in, wrong password, sign-out
  invalidation), UI journey sign-in.

### SEC-02 Authorization

**Implemented (verified).**

- `withApi` is deny-by-default: any route without `public: true` requires a
  session; `roles` adds a coarse role gate.
- Services enforce object-level rules (ownership, requester, resource owner,
  incident involvement) and return 404 for foreign objects to avoid confirming
  existence.
- All repositories take `institutionId` and filter by it.
- Denied requests to role-gated routes and `FORBIDDEN`/`NOT_FOUND` service errors
  are written to the audit trail with outcome `DENIED` and a request id.
- Evidence: `TC-SEC-01..11`, demo D12 (403/404 + redirect).

### SEC-03 Input validation and output escaping

**Partially Implemented.**

- Every mutation parses input with a Zod schema (`src/lib/schemas.ts`) and
  returns field-level 422 errors.
- SQL uses bound parameters. Search terms containing SQL fragments match nothing
  (`TC-CAT-04`).
- React escapes rendered text by default; no `dangerouslySetInnerHTML` was found.
- Security headers are set in `next.config.ts`: `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY`, and a CSP with `frame-ancestors 'none'`,
  `base-uri 'self'`, `form-action 'self'`. The CSP allows
  `script-src 'self' 'unsafe-inline'` because Next.js injects inline bootstrap
  scripts; this weakens the CSP and is a known limitation.
- **Gap:** no test renders `<script>alert(1)</script>` as a purpose/notes value
  (guide TC-SEC-05). Escaping is expected from React, but it is **Not Verified**
  by an executed test.

### SEC-04 CSRF

**Partially Implemented.**

- Session cookies are `SameSite=Lax`.
- Every non-GET request passing through `withApi` checks the `Origin` header
  against `APP_ORIGIN` and the request origin. A mismatching origin gets 403.
- **Limitation:** if the `Origin` header is absent, the check is skipped. This
  affects non-browser clients; a browser cross-site form POST normally sends
  `Origin`. There is no CSRF token.
- **Gap:** no dedicated CSRF test was executed.

### SEC-05 Rate limiting

**Implemented at the unit level; HTTP behaviour Not Verified.**

- Sign-in: 10 attempts / 15 min per email + IP.
- Booking creation: 20 / hour per user.
- Incident creation: 10 / hour per user.
- The limiter is in-memory and per process (`src/server/rate-limit.ts`), so it is
  single-instance only and resets on restart.
- Evidence: `TC-AUTH-10` tests the limiter directly. No HTTP request was driven
  past the threshold to observe a 429.

### SEC-06 Secrets

**Implemented (verified by scan).**

- `.env` is git-ignored (`.gitignore` line 8); `.env.example` contains only
  placeholders.
- The seed reads `DEMO_USER_PASSWORD`; if empty it generates a password and
  prints it once locally. Nothing is stored in source, seed data, UI or docs.
- The repository text scan found only references and the empty placeholder.
- `git status` shows untracked project files but no `.env`; no commit exists yet.
- **Owner action required:** keep `.env` untracked when committing.

### SEC-07 Audit minimization

**Implemented by code review; not test-enforced.**

- Audit metadata contains ids, roles, statuses, conditions, ranks, counts,
  reason codes, and resource names on admin create/edit. Passwords, tokens and
  cookies are never written.
- Incident descriptions and condition notes are stored on their entity, not
  copied broadly into audit metadata.
- **Gap:** `TC-AUD-02` (no secrets in audit metadata) was not automated; this is
  a manual code review result, labelled **Not Verified**.

### SEC-08 Privacy-aware seed

**Implemented (verified).**

- All names, emails and assets are fictional; emails use the reserved
  non-routable `@riverbend-demo.example` domain.
- UI copy labels the institution and data as fictional.
- A second institution and user exist only in the test database.

### SEC-09 Evidence privacy

**Partially Implemented.**

- Condition reports and incidents are visible only to involved roles: requester,
  resource owner and administrators; borrowers get a limited view
  (`TC-INC-03`, `TC-SEC-05`, `TC-PASS-02`).
- The incident report form warns users not to include personal or sensitive
  information.
- **Gap:** condition-report notes do not show the same warning. Images are not
  supported in the MVP.

### SEC-10 Dependency hygiene

**Implemented (verified).**

- `npm audit --omit=dev`: **0 vulnerabilities**.
- `npm audit` (including dev dependencies): **0 vulnerabilities** on 2026-10-30.
- No claim is made that future advisories will not appear.

### SEC-11 Error handling

**Implemented by code review.**

- `AppError` responses expose a stable code, a safe message, optional field
  errors and a request id.
- Unexpected errors are logged server-side with stack and request id; clients
  receive a generic 500 with the request id (`src/lib/api.ts`).
- SQLite trigger errors are mapped to a generic 409 booking-conflict message.
- **Gap:** no test asserts that a forced 500 hides the stack trace.

### SEC-12 Transport

**Documented.**

- The demo runs over HTTP on localhost. Production use requires HTTPS, at which
  point `APP_ORIGIN` must be set to the https origin so the session cookie gets
  the `Secure` flag.
- No TLS termination is included in the app.

## Abuse cases

| ID    | Abuse case                                      | Mitigation in this build                                                                           | Status                                                                 |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| AB-01 | Booking flooding to hoard equipment             | 3 open bookings, 2 waitlist entries, 24 h/week limits; per-user create rate limit; owner approval  | Implemented (limits tested; HTTP 429 not exercised)                    |
| AB-02 | Tampering with booking/resource/institution IDs | Object-level checks, tenant filters, 404 on mismatch                                               | Implemented (TC-SEC-01, 04)                                            |
| AB-03 | Calling approve/checkout/return directly        | Role gates and service checks                                                                      | Implemented (TC-SEC-03, demo D12)                                      |
| AB-04 | Double submit / replay                          | `Idempotency-Key` unique per requester                                                             | Implemented (TC-BOOK-03, concurrency round B)                          |
| AB-05 | Race to double-book                             | SQLite overlap trigger + `BEGIN IMMEDIATE`; 4-process creation race (20 rounds)                    | Implemented for creation races; **parallel approve race Not Verified** |
| AB-06 | Script injection in purpose/notes               | React escaping, Zod limits, CSP (with `unsafe-inline` caveat)                                      | **Not Verified** by a test                                             |
| AB-07 | User enumeration via sign-in                    | Identical generic error and timing path for wrong password/unknown email                           | Implemented (TC-AUTH-02)                                               |
| AB-08 | Owner approving own request / self-dealing      | Self-booking blocked at creation (`SELF_BOOKING`); approval of a self-owned request is unreachable | Partial — no dedicated approve-own test                                |
| AB-09 | Stale approval after eligibility/state change   | Approval re-checks state and eligibility in the service                                            | **Not Verified** by a test                                             |
| AB-10 | Leaking other users' data via Passport/history  | Role-filtered passport, own-booking filtering, hidden audit for borrowers                          | Implemented (TC-PASS-01..03)                                           |

## Remaining risks / limitations to disclose

1. SQLite demo-grade deployment; not a production concurrency or multi-tenant
   claim.
2. In-memory rate limiting is per process and resets on restart.
3. Audit append-only is enforced by database triggers, not cryptography; anyone
   with write access to the SQLite file can modify history.
4. CSP allows inline scripts (Next.js requirement).
5. Origin-based CSRF check is skipped when `Origin` is absent.
6. No automated test for XSS rendering (TC-SEC-05), stale-approval re-check
   (TC-BOOK-08), audit metadata minimization (TC-AUD-02), or HTTP 429.
7. No formal security audit, penetration test or compliance certification is
   claimed.
