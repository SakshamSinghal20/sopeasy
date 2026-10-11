# Team review build

This deployment opens directly into an isolated sample workspace. It is a product review sandbox. Use fictional process notes only. It does not authenticate employees or provide a shared company workspace.

Each browser receives an HttpOnly capability cookie and a separate set of fictional owner, reviewer, and reader identities. Use **Switch demo role** to test review and acknowledgement. Role and workspace checks still run on the server. Another visitor cannot open your procedure link. Send reviewers the application home link so each can try the workflow in their own sandbox.

Your account menu offers **Start a fresh sandbox**. A sandbox expires after three days. The free Render service has ephemeral storage: restarts and redeployments may reset it earlier, and waking from idle can delay the first request. Do not rely on the review build for record retention.

## Hosting

Frontend: https://sopeasy-review.vercel.app
Backend health: https://sopeasy-review-api.onrender.com/api/health
Private source: https://github.com/SakshamSinghal20/sopeasy

- GitHub: private repository; credentials, local SQLite databases, and QA artifacts are excluded.
- Vercel: static Vite frontend. `/api/*` requests proxy to the Render service, preserving same-origin browser cookies.
- Render: Docker Node 24 backend, `REVIEW_MODE=true`, `API_ONLY=true`, `DEMO_MODE=false`. No persistent disk is required for this disposable review build.
- AI: server-side provider key only. The sample-data review caps the service at 50 AI requests per UTC day and three concurrent requests. Resetting a sandbox does not reset the service quota. Manual editing remains available.
- Email: disabled in the review build. Account verification, password reset, and invitations belong to the authenticated release.
- CI: `npm run verify` on push and pull request.

## Review sequence

1. Open the home link. No signup is needed.
2. Create a procedure, enter fictional process notes, and draft or edit its steps.
3. Submit it to Arjun for review.
4. Switch demo role to Arjun, open Reviews, inspect the submitted revision, and approve it or request changes.
5. Switch to Maya, publish the approved procedure, and assign it to Leena.
6. Switch to Leena, open the assignment, read the current published version, and acknowledge it.
7. Return to Maya to check the receipt, export a PDF, and revise the procedure. Publishing a revision requires a new approval.

## Before real company use

Deploy a separate database with `REVIEW_MODE=false`, configure email delivery, attach a writable persistent disk, verify backup restoration, and test registration, email verification, invitations, and password reset through the deployed site. Keep real data out of the review database. The authenticated production entry points do not allow sample-role switching.
