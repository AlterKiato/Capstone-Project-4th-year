# ThesiSHS AI — Master Context

**Last reconciled:** 2026-10-07
**Current branch:** `feature/development`
**HEAD checkpoint:** `73ca174` — `docs(progress): record Phase 4 audit commit`
**Working tree:** Phase 5.1/5.2 source changes and existing documentation/`.github/` changes are uncommitted; the Phase 5.2 handoff commit is scoped to the six requested documentation files.

> This file is the **current-state handoff document**. Treat the working tree as current source evidence and keep its uncommitted state explicit.

---

## 1. Current Project State

The current checkout is at `73ca174` with Phase 5.1 and Phase 5.2 implementation changes in the working tree. Those phases have completed runtime acceptance; do not infer that the changes are part of `HEAD` or discard them.

### Current phase status

| Phase | Feature | Status at current checkout |
|---|---|---|
| 0 | Project Foundation & Environment | ✅ Complete |
| 1 | Authentication & Access Control | ✅ Complete |
| 2 | Research/User Foundation | ✅ Complete |
| 3 | Submission & Version Management | ✅ Complete |
| 4 | Adviser Review & Feedback | ✅ Complete |
| 5.1 | Document Storage Foundation | ✅ Complete and runtime-accepted |
| 5.2 | Submission ↔ Document Integration | ✅ Complete and runtime-accepted (service-level, not browser-level) |
| 5.3 | Next Phase 5 task | ⏸️ Start-gated; do not begin until directed |
| CI | Continuous integration | ⏸️ Explicitly deferred |

**Panel Evaluation:** excluded/deferred unless explicitly reopened.
**AI-assisted evaluation/chat/summarization:** planned, not current implementation.

---

## 2. Git / Rollback Boundary

The authoritative current checkpoint is:

```text
branch: feature/development
HEAD:   73ca174
message: docs(progress): record Phase 4 audit commit
```

The Phase 5.1/5.2 implementation is present in the current working tree, not in the recorded `HEAD` commit. Always inspect Git status and actual source before making claims about the checkout.

Before changing code, verify the actual checkout:

```bash
git status
git branch --show-current
git log -1 --oneline
git log --oneline --decorate -10
```

Do not restore historical work blindly. Inspect the current source first and re-implement only what is actually required.

---

## 3. Phase 4 — Adviser Review & Feedback

Phase 4 Adviser Review & Feedback remains complete. Phase 5.2 is the latest completed implementation milestone.

### Verified workflow

```text
Student submits
      ↓
Adviser notified
      ↓
Adviser starts review
      ↓
Under Review
      ↓
Revision Required ──→ Student resubmits a new version
      │
      └──────────────→ Approved
```

Established Phase 4 behavior:
- Adviser access is scoped to their own research groups.
- Advisers can start review.
- Advisers can provide feedback and select `Revision Required` or `Approved`.
- Submission/research status updates are coordinated.
- Submission versions are preserved.
- Student/adviser in-app notifications are triggered.
- Adviser decisions are activity-logged.
- Cross-adviser isolation was verified.
- The end-to-end review/resubmission/approval workflow was verified.

Relevant commits:
- `c425f1a` — `feat(submission): enforce unique paper versions`
- `cad078c` — `feat(notification): notify students of adviser decisions`
- `4499aea` — `feat(notification): notify adviser of new submissions`
- `bc87caf` — `fix(review): close Phase 4 regression audit`

Notification delivery failure handling was deferred within the Phase 4 closure audit scope. Phase 5.2 separately verified post-commit notification failure as non-blocking.

---

## 4. Phase 5 Status

Phase 5.1 Document Storage Foundation and Phase 5.2 Submission ↔ Document Integration are complete and runtime-accepted.

The stable design in `SOURCE_OF_TRUTH.md` calls for:
- private Supabase Storage
- bucket `research-submissions`
- PDF-only documents
- maximum file size of 10 MB
- storage path pattern `research/{paperId}/{version}/{sanitizedFileName}`
- server-side authorization before document access
- server-generated signed URLs
- five-minute signed URL expiry
- database storage of the storage path rather than a public URL

### Phase 5.2 implementation and acceptance

- Submission version calculation and eligibility checks are serialized per paper using a transaction-scoped PostgreSQL advisory lock; the unique `(paper_id, version)` constraint remains the database backstop.
- If a concurrent request loses, it observes the committed state and is rejected without leaving an uploaded object.
- Adviser feedback, conditional submission status, research status, and activity log writes use one database transaction. Competing decisions cannot both commit.
- Student/Adviser notifications are attempted after the primary operation commits. Runtime fault injection confirmed notification failure does not make submission/review appear failed or roll back primary records.
- Runtime acceptance was service-level, not browser-level. Synthetic fixtures were cleaned up. Phase 5.2 required no schema or migration changes.
- Migration `0009_repository_paper_unique.sql` was not applied.

Phase 5.3 is the next start-gated task. Do not start it or CI until explicitly directed.
6. Use Playwright for safe browser acceptance where appropriate.
7. If a test mutates counters, perform controlled manual verification rather than risking production-like data.
8. Inspect migrations before applying anything.

---

## 5. Phase 6 and Phase 7 Context

The project handoff recorded prior Phase 6 and Phase 7 work separately from the current Phase 5 completion. Verify their source and acceptance status from the actual checkout before treating those milestones as current:

### Phase 6 — Search, Filtering & Discovery
Historical work included repository search/filter/sort/pagination, empty-state handling, access-boundary testing, and synthetic acceptance data.

### Phase 7 — Administration & Reporting
Historical work included dashboard/reporting metrics and an Admin reports page.

Do not infer their implementation or acceptance state from this Phase 5.2 handoff.

---

## 6. Stable Project Rules

These rules remain applicable:

- Layered architecture: Pages/UI → Server Actions → Zod validation → Services → Repositories → Drizzle ORM → PostgreSQL.
- Business logic and authorization belong in services.
- Repositories remain focused on data access.
- Authorization must be enforced server-side.
- Verify ownership/group access before protected operations.
- Students do not self-join research groups; advisers assign/remove students.
- A student has one active group membership.
- Preserve submission versions rather than overwriting them.
- Submission versions use unique `(paper_id, version)`.
- Notifications are currently in-app only.
- Notification failure must not block the primary operation.
- Panel Evaluation is excluded/deferred.
- AI assistance must not replace final human academic/review decisions.
- Supabase secret credentials remain server-only.
- Store storage paths rather than public document URLs.
- Generate signed document URLs server-side.
- Keep test and production environments/data separate.
- Never commit secrets.

---

## 7. Database / Migration Safety

`DATABASE.md` is the database reference, while the actual `db/schema/`, `db/migrations/`, and target database are authoritative.

The documentation historically referred to 11 core tables while explicitly naming 10. **Do not invent an eleventh table.** Verify the actual schema before resolving that discrepancy.

Migration `0009_repository_paper_unique.sql` was not applied. Inspect the actual migration directory and intended database before any future application; migration state can differ between environments.

Before applying schema changes:

```bash
npx drizzle-kit check
```

Then review the generated SQL and target data before migration.

---

## 8. Documentation Roles

The project documentation is intentionally separated:

- `SOURCE_OF_TRUTH.md` — stable product rules, architecture, constraints, and long-term design.
- `MASTER_CONTEXT.md` — current implementation state, working-tree boundary, blockers, and next action.
- `README.md` — documentation navigation and AI-agent handoff entry point.
- `ARCHITECTURE.md` — technical architecture and data flow.
- `DATABASE.md` — database structure and migration safety.

A future agent should not need the historical chat to understand the current project state.

---

## 9. Agent Handoff Protocol

Before implementation:

1. Read `SOURCE_OF_TRUTH.md`.
2. Read `MASTER_CONTEXT.md`.
3. Read `README.md`.
4. Read `ARCHITECTURE.md`.
5. Read `DATABASE.md` for database work.
6. Inspect the actual repository and working tree; `73ca174` is the current HEAD checkpoint, while Phase 5.1/5.2 changes are uncommitted.
7. Check working-tree changes before modifying files.
8. Do not discard unrelated working-tree changes.
9. Do not commit without project-owner approval.

Every handoff should record:
- phase/feature
- implementation status
- files changed
- database/migration changes
- test evidence
- blockers/risks
- exact next action
- commit hash, if applicable

---

## 10. Immediate Next Action

Development is currently paused while the project documentation is being consolidated for lower-context, more efficient AI-assisted development.

When the owner authorizes the next phase, first:

> **Verify this documentation handoff commit and current working tree, then wait for explicit direction before starting Phase 5.3. CI remains deferred.**
