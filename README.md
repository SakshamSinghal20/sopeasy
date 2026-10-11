# SOPEasy

A complete office operations and HR onboarding SOP workspace, built from the PRD. React 19, Node 24, Express, and persistent SQLite. The interface follows the Process Atlas direction in [DESIGN.md](DESIGN.md).

The no-sign-in team review deployment uses isolated, disposable sample workspaces. Read [REVIEW-DEPLOYMENT.md](REVIEW-DEPLOYMENT.md) for its workflow and limits. Real company use requires the authenticated release and persistent storage.

## Run locally

```powershell
cd sopeasy
npm install
Copy-Item .env.example .env # only for a fresh setup; preserve an existing .env
npm run dev
```

Open http://localhost:4197. The current workspace already has a private `.env`. It is excluded from Git and Docker. Dependencies need Node 24 or newer for built-in SQLite.

The local demo contains explicitly fictional people and procedures. Explore as Maya (Owner), Arjun (Author/reviewer), and Leena (Reader), using the role switcher. Demo access is disabled in production. Create an account and another workspace to start with an empty library.

## What works

- Email verification, password sign-in, password reset, expiring invitations, workspace switching, and four server-enforced roles.
- Four starter templates and blank documents; guided capture and separately retained source notes.
- Structured drafting, paragraphs, emphasis, bullets, simple pipe tables, ordered steps, checklists, autosave, revision conflict recovery, and checkpoints.
- Live Sarvam draft and section-rewrite proposals, preview/acceptance, source references, blocking questions, cancellation, stale-proposal checks, quotas, bounded provider retry, and manual fallback.
- A distinct eligible reviewer; locked submission snapshots, change requests, revision-bound approval, and invalidation after edits or reviewer removal.
- Atomic, idempotent publication; immutable numbered history; internal authenticated links; maintenance dates; all-team or selected reading assignments.
- Version-specific acknowledgements and receipts; overdue status; reminder notifications; operational dashboards and reports.
- Paginated library and search with permission checks and filters; document duplication, ownership transfer, archive, and restoration requiring fresh publication.
- Workspace logo/name/timezone settings; PDF, acknowledgement CSV, workspace JSON exports; seven-day deletion recovery; purge completion records.
- Daily SQLite backups, 30-day backup retention, restart recovery for interrupted AI jobs, and a deployment health endpoint.

## Verification

```powershell
npm test
npm run build
npm run backup
node scripts/benchmark.mjs
node scripts/evaluate-ai.mjs --list
node scripts/evaluate-ai.mjs --self-test
node scripts/evaluate-ai.mjs --live
node scripts/evaluate-ai.mjs --live --rewrites
```

The integration and domain suite exercises the complete manual and grounded AI loops, tenant permissions, concurrent edits, review locks, invalid approval, duplicate publication, old-version receipt races, archive/restoration, exports, identity tokens, deletion/recovery, AI failure/cancellation/staleness, provenance validation, reminders, durable reopening, and backup restoration. The evaluation script requires `--live` to call the real provider against 30 diverse fictional fixtures or six section rewrites; it can incur provider usage charges and runs at most three requests concurrently. `--smoke` selects a compact subset. `--replay <evaluation.json>` rerenders saved provider layouts with zero provider calls; replay does not measure live provider latency. Reports and browser screenshots are saved privately in `.qa/`. [IMPLEMENTATION.md](IMPLEMENTATION.md) maps the implementation to the PRD acceptance scenarios and records the remaining deployment gates.

The browser exercise completes AI generation, clarification/regeneration, proposal acceptance, section rewriting, cancellation, checkpoint recovery, autosave during delayed responses, separate-account review, publication, and reader acknowledgement. The final fictional test procedure is archived with its exact-version receipt retained. Editor, review dialog, and desktop/mobile reader axe scans found no tested violations; layouts at 360px and 640×450 had no horizontal overflow. The responsive interface respects reduced-motion settings and uses self-hosted fonts. This is not a claim of a full independent accessibility certification or an uptime SLA.

The local performance harness uses 50 active memberships, 1,000 procedures, and ten independently signed-in clients. Across 100 requests per category, measured p95 was 219 ms for a paginated library, 231 ms for search, and 508 ms for autosave. This excludes browser rendering and real broadband latency.

## Provider and email configuration

Set `SARVAM_API_KEY` on the server to enable AI. `SARVAM_CHAT_MODEL` defaults to `sarvam-105b`; `SARVAM_MAX_TOKENS` defaults to 4096. Set `AI_DISABLED=true` to retain all manual workflows while disabling generation. Explicit consent is required before sending this procedure's title, vetted process clauses, saved author clarifications, and the authored target section to Sarvam. No other workspace documents are sent. Keys are never included in client bundles or exports.

The provider uses structured JSON output with reasoning disabled, plus independent application validation. This follows [Sarvam's documented structured-output contract](https://docs.sarvam.ai/api/api-guides-tutorials/chat-completion/overview). AI proposes an evidence layout rather than writing new policy claims. The application constructs policy text from vetted source clauses, retaining source wording and action order. Both source notes and trusted author decisions remain attached to their immutable generation snapshot. Conflicting alternatives are withheld and cited in a blocking question; vague acknowledgements cannot settle them. A source-only actor excerpt supplies the step owner when identified. A rewrite changes its selected section, retaining every other authored field exactly.

Acceptance reconstructs and compares content, questions, citations, and certified conflict resolutions against the original evidence. Edited or outdated proposals require regeneration. Each request is bounded to 100 source sentences, two transient-failure attempts, and 90 seconds; cancellation aborts provider work. Human review must still check factual accuracy, source completeness, useful section placement, and procedure usability. Before using real employee information, verify provider retention/training settings and your organization's agreement. Those settings have not been established by this implementation.

The corrective evaluation uses 30 diverse office/HR inputs and six section rewrites, with literal critical-fact, citation, conflict, hostile-command, and non-target preservation checks. Historical failures are retained independently of current reports. Exact provider responses and the two-reviewer rubric are indexed in `.qa/AI_FIDELITY_REVIEW.md`; current convenience reports are `.qa/ai-evaluation.json` and `.qa/ai-rewrites.json`. Production AI is disabled by default, even when a provider key is present. Explicit `AI_DISABLED=false` is required after independent operations/HR and product reviews, usability review, and provider privacy terms are confirmed. Those human approvals remain pending.

The corrected `office-sop-v5` / `evidence-layout-v4` live run passed all 36 cases on their first attempts and all 649 bounded assertions. Measured p95 generation latency was 1.42 seconds for drafts and 0.74 seconds for section rewrites. The final local test/build verification passed 78 tests, including all eight rewrite targets, accepted-evidence persistence, and checkpoint recovery with complete provenance. These measurements establish the tested cases; they do not certify every possible input or replace human review.

Four additional live edge cases passed all 66 assertions: a mixed negative policy and hostile command, an invalid conflict acknowledgement, conflicting source and authored deadlines, and pasted numbered/bulleted notes. The combined fresh evaluation passed 40 of 40 cases and 715 assertions. Offline evaluator controls also reject changed facts, citations, order, negation, unsafe commands, false gaps, and unintended section changes.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` for actual email. Without SMTP, development displays explicit local verification/reset/invitation links and stores a local outbox. Production refuses to start without SMTP and never returns these links in API responses. Production delivery has not been verified with a live email account.

## Deploy

Run a **single Node application instance with a persistent local volume**; SQLite workspace transactions serialize writes. Use a VPS or container host, HTTPS reverse proxy, encrypted disk/volume, and off-host encrypted backup storage. An ephemeral serverless filesystem is unsuitable. Horizontal replication requires a database migration, not multiple containers sharing this file.

```sh
docker build -t sopeasy .
docker run --env-file production.env -p 4197:4197 -v sopeasy-data:/data sopeasy
```

Use [production.env.example](production.env.example) as the configuration template. `production.env` must set `NODE_ENV=production`, `DEMO_MODE=false`, `HOST=0.0.0.0`, an HTTPS `APP_URL`, and SMTP credentials. Keep secrets outside the image. The volume must be writable by the container's `node` user. Terminate TLS at your proxy. HTTPS cookies, same-origin mutation checks, and production CSP are applied by the server. Keep `AI_DISABLED=true` until the PRD evaluation and privacy gates are reviewed.

Build artifacts are served by the same authenticated server. `/api/health` verifies database access. The application is running locally; no production site has been provisioned or deployed. Docker packaging has been provided; a Docker image build has not been executed in this environment.

## Backup, restoration, and retention

`npm run backup` uses SQLite `VACUUM INTO`, then verifies the backup with `PRAGMA integrity_check`. Automatic backups use the same snapshot mechanism. Copy completed backups to encrypted off-host storage. Local backups alone do not protect against loss of the computer or volume.

To restore, stop the application, preserve the current `DATA_DIR`, move its database and associated `-wal`/`-shm` files into a separate recovery folder, and copy a verified backup to `DATA_DIR/sopeasy.sqlite`. Start the app and confirm membership, current versions, and receipts. Restore is an operator action; do not replace a live database. The tests restore a separate snapshot and compare stored records.

Deletion disables the workspace for seven days. After expiry, a maintenance job deletes its active records and stores only its workspace ID, completion action, and timestamp. Generated PDFs/CSV are delivered directly rather than left as public files. Cancelled/failed proposals and local outbox records expire after 30 days. Daily backups expire after 30 days; deploy operators must apply the same retention to off-host copies.

## Data model and export contract

SQLite holds normalized identities, memberships, sessions, tokens, invitations, outbox, and lifecycle records. Each workspace owns a transactionally updated JSON state containing procedures, candidates, checkpoints, submissions/approvals, immutable versions, assignments, receipts, proposals, notifications, maintenance records, and audit events. Authorization is evaluated again inside mutations. This intentionally suits the PRD's initial pilot envelope.

Workspace JSON exports use `sopeasy-workspace-v1`. Dates are UTC ISO strings, identifiers are UUIDs, published version numbers start at 1, and receipt records bind the membership and exact version. Passwords, session tokens, and provider keys are excluded. CSV reports contain procedure, version, recipient, state, deadline, and receipt time; formula prefixes are escaped. PDF footers include version, page number, and a sign-in-required current-library link.

## Remaining release validation

The implementation is ready to explore locally and to deploy into a configured staging environment. Production onboarding still needs live SMTP verification, hosting/TLS/encrypted-volume setup, provider agreement confirmation, two-person HR/product review of the 30-case AI report, staging load/accessibility review, and off-host recovery rehearsal. Local measurements do not establish the PRD's ten-user broadband or monthly availability targets. Billing, SSO, external HR integrations, process execution, and native mobile apps remain outside the agreed P0 scope.
