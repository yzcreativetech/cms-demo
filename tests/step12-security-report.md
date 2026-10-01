# Step 12 Security QA — 2026-10-01

Overall acceptance: **PASS**. The initial anonymous run passed 25 checks; the
completed authenticated run passed all 44 checks, including repeated anonymous
checks. User-confirmed admin execution is corroborated by the sanitized result
file. The only recorded Storage QA object is confirmed removed by a fresh live
read. `milestone.md` is **COMPLETE**; previous milestone history is unchanged.

## Evidence and scope

- Initial working tree was clean.
- Reviewed `milestone.md`, both SQL schema/security files, frontend configuration,
  auth service, login, route guard, content/announcement persistence, image upload,
  and validation modules before testing.
- Live tests use the configured frontend public key and real Supabase endpoints
  from fresh Chrome profiles. No service-role key, policy changes, or mocked
  backend responses were used.
- `python tests/step12-security.py` passed 25 checks. Sanitized results are in
  `tests/step12-anonymous-results.json`. The completed `--admin` run is recorded
  in `tests/step12-admin-results.json` (2026-10-01T01:22:20.211Z; 44/44 PASS).
- Anonymous DELETE tests target absent ID 0. Explicit permission errors prove
  denial at the table-grant layer; no zero-row success was treated as proof of RLS.
- Homepage INSERT uses existing singleton ID 1. Only the returned permission
  error counts as success, not a uniqueness/constraint error.
- Homepage UPDATE attempts use existing values. Anonymous announcement INSERT
  was rejected; admin INSERT/UPDATE/DELETE exercised a uniquely identified
  `SECURITY-QA-TEMP` row and removed it afterward.

## Database matrix

| Operation | Anonymous | Admin |
|---|---|---|
| homepage SELECT | PASS: HTTP 200, one row, ID 1 | PASS: HTTP 200 |
| homepage UPDATE | BLOCKED: HTTP 401 / 42501 | PASS: HTTP 200, one row |
| homepage INSERT | BLOCKED: HTTP 401 / 42501 | N/A |
| homepage DELETE | BLOCKED: HTTP 401 / 42501 | N/A |
| announcement SELECT | PASS: HTTP 200, one row | PASS: HTTP 200 |
| announcement INSERT | BLOCKED: HTTP 401 / 42501 | PASS: HTTP 201, one temporary row |
| announcement UPDATE | BLOCKED: HTTP 401 / 42501 | PASS: HTTP 200, temporary row |
| announcement DELETE | BLOCKED: HTTP 401 / 42501 | PASS: HTTP 200, temporary row removed |

`42501` is an insufficient-privilege rejection. These checks establish effective
anonymous authorization; they do not independently inspect the deployed RLS
catalog or prove the authenticated UUID policies match local SQL.

## Storage matrix

| Operation | Anonymous | Admin |
|---|---|---|
| Existing published image read | PASS: HTTP 200, image decodes | PASS: HTTP 200 |
| Valid 88-byte PNG upload into hero/ | BLOCKED: Storage code 403, row-level security | PASS: accepted |
| Unsupported text/plain upload | BLOCKED: Storage code 415, MIME validation | BLOCKED: Storage code 415, MIME validation |
| PNG upload greater than 5 MiB | BLOCKED: Storage code 403, row-level security | BLOCKED: Storage code 413, size validation |

Storage codes above are SDK-returned Storage error codes, not necessarily the
outer HTTP transport status. The tiny PNG was generated and decoded by Chrome.
Oversized anonymous rejection proves authorization only. The authenticated
oversized upload independently confirmed live size validation (Storage code 413).
Real frontend MIME and size validation also rejected the corresponding Files.

The documented public bucket is `cms-demo`, with PNG/JPEG/WebP, maximum 5 MB,
and admin uploads under `logos/`, `hero/`, or `movement/`. UPDATE/DELETE policies
are intentionally absent. They were not broadened.

## Auth, sessions, and UI bypass

| Check | Result |
|---|---|
| Valid admin login / editor opens | PASS |
| Invalid credentials | PASS: HTTP 400, generic useful error, password input cleared |
| Existing admin email with invalid password | PASS: rejected, HTTP 400 |
| Refresh while authenticated | PASS: editor remains accessible |
| Logout clears session and redirects | PASS: HTTP 204, session cleared, login redirect |
| Logged-out direct /admin/index.html | PASS: redirected to login |
| Fabricated invalid persisted session | PASS: redirected to login |
| Invalid token direct protected write | BLOCKED: HTTP 401 |
| Exposed/enabled editor Save while logged out | BLOCKED |
| Exposed editor valid image upload while logged out | BLOCKED |

UI bypass used a test-server copy of the editor HTML without its route-guard
script, explicitly revealed the body and enabled controls, and ran the real
editor/persistence modules. Production HTML and JavaScript were not edited.
Independent direct API write tests also bypassed all UI restrictions.

## Secret exposure audit

Scanned all 35 tracked files and all 12 reachable Git commits, covering 80 unique
text-file versions. Checks included privileged Supabase keys, non-anon JWTs,
credentialed PostgreSQL URLs, literal password/access/refresh-token assignments,
private key blocks, and common private API/token patterns. Sensitive-term
locations in current files were reviewed without printing secret values.

| Exposure | Result |
|---|---|
| Service-role / sb_secret_ key | No candidate found |
| Database password / credentialed PostgreSQL URL | No candidate found |
| Hard-coded CMS password | No candidate found |
| Auth access/refresh tokens or private keys | No candidate found |
| Public Supabase URL and anon key | EXPECTED; JWT role is anon |

This is a pattern scan and source review, not a guarantee against every possible
secret encoding. It covers reachable history, not dangling Git objects.

## Cleanup and content integrity

- Authenticated-run snapshots confirmed real homepage content and all real
  announcement rows remained unchanged. Homepage `updated_at` may have advanced
  because the authorized no-op UPDATE exercised the real update trigger; this is
  expected metadata behavior. Announcement timestamps remained unchanged.
- A final read-only live query on 2026-10-01 found zero rows with title
  `SECURITY-QA-TEMP` or a description containing `security-qa`. The homepage still
  has exactly one row, ID 1.
- The only successful Storage upload recorded in either QA result file was
  `cms-demo/hero/security-qa-1790817637373-Admin-valid.png`.
- After manual Dashboard cleanup, a fresh cache-busted public GET returned HTTP
  400 with Storage `statusCode: 404`, `error: not_found`, and `code: NoSuchKey`.
  Its removal is confirmed; **no Storage objects from the recorded QA runs remain**.
  This is reconciliation of the complete recorded artifact list, not a privileged
  bucket-wide inventory of unrelated runs. Public reads do not grant object listing.
- No application code or SQL policies were changed to make tests pass. No further
  security correction is required by the executed acceptance checks.

## Repository handoff

- `milestone.md`: Step 12 and its progress-table entry are COMPLETE, with concise
  final evidence. Earlier milestone history is unchanged.
- `tests/step12-security-report.md`: this final acceptance and cleanup report.
- Untracked QA files: this report, `step12-security.py`, `step12-security.js`,
  `step12-anonymous-results.json`, and `step12-admin-results.json` (all under `tests/`).
- Recommend committing the runner, final report, and these two sanitized JSON
  results together when a commit is authorized: the JSON files are useful dated
  acceptance evidence, contain no credentials, and preserve the original upload
  record. Do not rewrite the historical artifact list to imply no upload occurred;
  cleanup is documented here. Incidental future rerun outputs need not be committed.
- `git status`, `git diff`, and `git diff --check` were run for final validation.
  No staging, commit, or push was performed.
