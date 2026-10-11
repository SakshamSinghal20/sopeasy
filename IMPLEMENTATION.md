# SOPEasy implementation and release evidence

This application implements the office operations and HR onboarding P0 workflow in [the PRD](../docs/sopeasy/PRD.md). Local verification is distinct from a production pilot approval.

## Implemented journey

Create a verified account → create an isolated workspace → invite a reviewer and readers → capture a procedure from a starter template or blank document → edit manually or preview an AI proposal → resolve questions → submit a locked revision → a separate eligible person approves → publish an immutable version → assign reading → collect exact-version receipts → revise, maintain, or archive.

The local demonstration uses fictional procedures and three separate identities. Real accounts start with an empty workspace. Demo authentication is unavailable in production.

## Evidence map

| PRD scenario | Implementation and verification |
| --- | --- |
| Invitations and identity | Hashed, expiring, one-use tokens; email identity and verification checks; reset revokes sessions; API integration checks |
| Complete manual loop | Browser creation, autosave, separate-account approval, publication, and reader receipt; domain/API checks |
| AI drafts and gaps | AI evidence layout; source-derived policy text; immutable citations; independently corroborated conflicts; saved-answer regeneration and guarded acceptance; diverse real-provider evaluation |
| Failure recovery | Save conflict recovery, retained draft/source notes, separate proposals, cancellation, stale application checks, restart failure state |
| Distinct reviewer | Candidate editor set, immutable submission hash, active eligible reviewer, approval invalidation; rejection checks |
| Atomic publication | SQLite transaction, expected revision/current version, idempotency payload binding, assignment/notification deduplication |
| Exact-version receipt | Current-version check and receipt commit in one transaction; repeat receipt returns original; history remains version-bound |
| Workspace and draft isolation | Every workspace route checks active membership; draft permissions also cover summaries, notifications, jobs, search and exports |
| Concurrent changes | Compare-and-save revision, publication and acknowledgement checks; stale requests rejected without overwriting saved content |
| Archive and restoration | Cancels unfinished reading and hides instructions; restore creates a candidate requiring fresh review and publication |
| Member removal | Access and sessions revoked, incomplete reading cancelled, unused approvals invalidated, historical accountability retained |
| Exports | Authenticated snapshot PDF, draft/version labels, current-library link; escaped CSV; documented workspace JSON |
| Responsive and accessible use | Desktop/mobile browser inspection, axe checks on key screens, semantic controls, focus treatment, reduced motion |
| Operations | Durable SQLite reopen and backup restoration checks, health route, generation disable flag, production configuration guards |
| Workspace lifecycle | Owner typed confirmation, seven-day disabled recovery, eventual content purge and content-free completion record |

Machine-readable reports and screenshots live in ignored `.qa/`; they contain only fictional test data. Integration checks are in `tests/workflow.test.mjs`. Re-run `npm run verify` after a change, and re-run the live AI fixture set after changing the model, prompt, template, or parser.

The corrective pipeline uses prompt `office-sop-v5` and validator `evidence-layout-v4`. The provider selects vetted source clauses and section placements; the application retains their wording, conditions, negations, and sequence. It independently corroborates conflict labels, keeps unresolved alternatives out of operative content, and requires a substantive saved decision before retiring them. Generation and transactional acceptance both reconstruct the proposal against its immutable notes, clarifications, and authored target evidence. Old-format, stale, edited, cancelled, and unconfirmed proposals cannot replace saved content. Accepted source metadata survives subsequent generation without becoming visible procedure text.

The independent evaluation covers 30 diverse fictional office/HR cases and six section rewrites. Its 649 bounded checks are distinct from API lifecycle tests and live browser workflows. Reports retain exact provider responses and prior failures; the review rubric is `.qa/AI_FIDELITY_REVIEW.md`. Production disables AI unless explicitly enabled after independent operations/HR and product review and provider privacy confirmation. These human reviews remain pending.

The corrected live version-four run accepted all 30 drafts and six rewrites on the first attempt, passing all 649 assertions. Draft p95 was 1,420 ms; rewrite p95 was 736 ms. The final `npm run verify` passed 78 tests and the production build. These tests cover all eight rewrite targets, exact non-target preservation, immutable citations, invalid-answer recovery after source rebinding, retained unrelated questions, accepted-evidence regeneration, list formatting, complete checkpoint recovery in both directions, explicit consent, idempotent retries, cancellation, permissions, stale proposals, and the AI-assisted review/publication/receipt lifecycle.

Four separate focused live cases passed 66 assertions, bringing the fresh evaluation to 40 first-attempt accepted cases and 715 passing bounded assertions. These inputs cover a legitimate negative policy mixed with an embedded command, an acknowledgement-only conflict answer, a source/authored deadline disagreement, and pasted list formatting. Their reports are retained separately from the unchanged 36-case core. Forty positive evaluator controls, 14 deliberately adverse controls, and four empty-provider-layout regressions pass offline.

The final live browser journey completed generation, clarification/regeneration, proposal acceptance, a scope-only rewrite, safe checklist-generation cancellation, and exact checkpoint recovery across content, notes, questions, and citations in both directions. A delayed save with newer typing retained that edit in its recovery checkpoint. Fictional Maya submitted to Arjun, Arjun approved, Maya published version 1, and Leena acknowledged that exact version at `2026-10-11T09:39:10.959Z` (receipt `b6ca6687-029f-459e-99eb-2439c9541a2d`). The published snapshot retained eight source blocks and 11 references. Test procedure `d1fb0b22-1696-4ada-9000-cbfecb7c94b8` is archived with its receipt retained and no active or ready AI jobs.

Fresh axe scans of the editor, review dialog, and desktop/mobile reader found zero tested WCAG A/AA violations. Layouts at 360px and 640×450 had no horizontal overflow; all eight rewrite controls remain available while editing. Reader outlines link only to rendered sections. The final frontend was formatted and rebuilt after this outline correction. These automated scans and inspected layouts remain distinct from independent accessibility certification.

## Local performance envelope

The local HTTP harness uses 50 active memberships, 1,000 procedures with five steps each, and ten independently signed-in clients. Each category samples 100 requests. It excludes browser rendering and a real broadband connection. The report is `.qa/performance.json`; it does not establish monthly availability or production service targets.

## Before onboarding a real team

- Provision HTTPS hosting with one Node instance and persistent encrypted storage; configure and verify SMTP delivery.
- Confirm provider retention/training terms for employee information and complete the two-person HR/product fidelity review of the evaluated AI drafts. Keep `AI_DISABLED=true` until these gates pass.
- Build and exercise the supplied Docker package in the target environment; configure off-host encrypted backups and rehearse restoration there.
- Verify representative long exports, keyboard/screen-reader tasks, browser performance over a real network, and monitoring in staging.
- Name the product owner, technical operator, and pilot support contact, then collect a team baseline before reporting pilot benefits.

Production SMTP, hosting, provider terms, independent human AI evaluation, and staging service quality have not been verified by a local build. Voice input, imports, email workflow reminders, SSO, HR integrations, billing, and process execution remain P1/P2.
