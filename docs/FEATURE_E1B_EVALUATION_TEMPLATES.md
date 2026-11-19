# Feature E1B: reusable evaluation template foundation

Date: 2026-11-18 (Asia/Manila). Parent checkout: `feature/development`, `a9d4fa5ce75e1a4fc29cf95ea913b4a3d5c176b2`. Implementation is local and uncommitted. Migration 0021 is generated only, NOT APPLIED. No Preview publication or authenticated database-backed acceptance is claimed. Owner-reported Visual-V1.5 hosted acceptance 5/5 PASS is preserved, not repeated.

## Implemented scope

The current active institutional Main Adviser can list/read, create, update, duplicate and archive their own evaluation templates. The secondary **Evaluation templates** link opens `/dashboard/adviser/submissions?view=templates`. Only that exact scalar query value selects management; other queries retain the existing submissions directory and Co-Adviser fallback. No primary navigation item is added.

Templates have 1–30 criteria (designed for 4–8), names up to 200 characters, optional descriptions up to 2,000 characters, stable UUID criterion keys, consecutive zero-based positions and individual N/A permission. Blank names, duplicate keys (including case variants), unknown fields and malformed ordering are rejected. Drafts remain in mounted browser memory and are not autosaved.

**Owner amendment supersedes E1A's proposed fixed scale:** each template owns a version-1 JSON scale definition, `{ version: 1, levels: [{ points, label, description }] }`. There are 2–5 consecutive integer levels, starting at 1; labels are required (maximum 80 characters), descriptions optional (maximum 300). New templates start with 1 Unsatisfactory, 2 Needs Improvement, 3 Satisfactory, 4 Excellent. These labels are editable product defaults, not institutional standards. No weights, fractional/negative points, formulas, thresholds, grades or academic outcome calculation exists.

## Ownership, atomicity and history boundary

Services obtain the current Main from server authentication; callers cannot supply an owner. Every repository transaction rechecks the active Adviser account and institutional singleton under `lockCurrentMainAdviser`, then scopes headers and criterion reads to the actor. Students, ordinary/Co-Advisers, Admin and Panel gain no template permissions. Replacing Main does not transfer private templates. A successor cannot read, edit or duplicate another account's templates. Successor duplication requires a future explicitly authorized sharing feature; sharing is not implemented.

Updates, scale changes, criterion replacement/reordering, revision advancement and audit insertion share one transaction. Stale expected revisions fail without overwriting. Duplication copies content and scale into a separate owned template with fresh criterion keys and revision 0. Archive preserves the header/criteria, advances revision and prevents update/duplication; default lists exclude archives. No template deletion or restore action exists. Audit entries contain IDs, revision and counts, not criterion text.

Finalized assessment history is deferred. E1C must snapshot the complete scale, template revision, criterion wording/order/N/A policy and ratings/comments in its own atomic official-feedback transaction. It must not reference mutable criterion rows as historical evidence. E1B introduces neither `submission_evaluations` nor `submission_evaluation_items`, and changes no official feedback/revision/submission workflow.

## Additive schema and migration boundary

- `evaluation_templates`: owner FK, name, JSONB scale, revision, archive/creation/update timestamps; owner/archive/id index.
- `evaluation_template_criteria`: template FK, criterion UUID, position, name, description, N/A permission; composite template/key primary key and template/position uniqueness.
- Restrictive foreign keys, bounded names/descriptions/positions, nonnegative revisions and JSON scale-shape/consecutive-point checks. Full strict scale/criterion validation and the nonempty criterion requirement are enforced in the service's Zod boundary and read mapper.
- `0021_evaluation_templates.sql`, `0021_snapshot.json` and one appended journal entry are generated through Drizzle. No pre-0021 migration or snapshot is changed; no seeds, backfill, grants or existing-table changes.
- `scripts/preview-migration-source.ts` pins the new 22-entry source while reconstructing the exact historical 21-entry OTP journal in memory. All prior digests and bounded migration selections remain unchanged. This does not add a migration executor or establish target readiness.

Future runtime privileges need review: SELECT/INSERT/UPDATE on template headers; SELECT/INSERT/DELETE on criteria for atomic list replacement; USAGE on the template sequence; existing Main-lock and audit prerequisites. Do not grant header DELETE, runtime DDL, grant options or browser/anonymous access. No grants were executed. Supabase Data API remains disabled. Applying 0021 to any database and validating actual PostgreSQL constraints/grants/concurrency require separate owner authorization.

## UI reference and review

Reused `DashboardHeader`, `ContextHelp`, `ResearchDialog` for archive confirmation, existing Manrope inheritance, native controls, `--surface`, `--foreground`, `--muted`, `--border`, `--border-strong`, `--action`, `--focus` and error tokens. The new local CSS module follows Adviser directory rows, separator lines, restrained borders and responsive wrapping. Shared global/shell/review CSS is unchanged.

List: one primary Create action, concise counts/scale summary, neutral row operations and optional archived disclosure. Editor replaces the list area; names and keyboard Up/Down/Remove controls stay compact. Descriptions/N/A settings and scale customization use native disclosure. There are no nested panels, charts, badges, added scroll regions or new dependencies. Reordering restores focus to the moved criterion input.

Dirty drafts protect Back to templates, page links, logout and beforeunload. Existing browser Back/programmatic-navigation limitations are not claimed solved. During uncertain saves, editing/retry is locked and the list requires an explicit reload. A stale draft remains available for inspection/copy until the owner chooses to discard it. No automatic write retry occurs.

## Focused evidence

- **12/12 E1B offline groups PASS:** 2/3/4/5 scales, invalid payloads, create/read/list, update/order/N/A, independent duplication, archive, role/designation/private-owner denial, stale revision, service/audit rollback, actual repository SQL guards/write sequencing, action refresh recovery and additive snapshot/history preservation. SQL-driver and transaction doubles are used, not PostgreSQL.
- **25/25 unchanged R1/R2/OTP migration groups PASS** alongside the initial 11 E1B groups (36/36 combined); the additional E1B SQL-write group passed afterward. No broad project suite.
- Current-source TypeScript: zero diagnostics. Targeted ESLint and `drizzle-kit check` PASS. No full Next.js production build was run; actual page/components were compiled by the synthetic esbuild browser harness.
- **9/9 bounded synthetic Chromium groups PASS:** actual query-selected route, manager/editor, create/custom 3-point scale/N/A, keyboard reorder, duplicate/archive dialog, validation/discard, long names/30 criteria, 360px and 1440px Light/Dark, visible focus/no horizontal overflow, uncertain-save recovery, original directory/status filter and non-Main management denial. Zero browser errors and unexpected requests. The harness intercepts every request and blocks live adapters; action/auth/data responses are synthetic.
- Agent inspected representative rendered Light/Dark desktop/mobile screenshots. Ignored evidence: `test-results/e1b/`. Manrope remains configured in source; this isolated harness uses font fallback and does not fetch fonts.
- Initial harness setup failures (restricted esbuild filesystem reads, unrelated Co imports, missing ThemeProvider) occurred before acceptance checks completed and were corrected. The final browser pass is distinct from those failed attempts.
- **NOT TESTED:** real PostgreSQL execution/catalog/constraints/grants/locking, authenticated Next Server Action/RSC transport, owner visual acceptance, physical devices, screen-reader speech, hosted/Production behavior and E1C/E1D.

Anti-Slop During delivery assessment: Hard Gate PASS within the synthetic tested surface (working controls, states, focus, wrapping and both themes); Purpose PASS (row controls/disclosures support editing, one primary action per view); Liveliness PASS (existing 1/2/1 dials, no new motion or decoration); Craftsmanship PASS for the bounded rendered checks. This is not full accessibility or owner acceptance certification.

## Exact implementation file scope

Changed existing paths:

- `app/dashboard/adviser/submissions/page.tsx`
- `db/schema/index.ts`
- `db/migrations/meta/_journal.json`
- `scripts/preview-migration-source.ts`

Added paths:

- `lib/evaluation-templates.ts`
- `lib/validations/evaluation-template.ts`
- `lib/repositories/evaluation-template.repository.ts`
- `lib/services/evaluation-template.service.ts`
- `lib/actions/evaluation-template.action.ts`
- `db/schema/evaluation-template.ts`
- `db/migrations/0021_evaluation_templates.sql`
- `db/migrations/meta/0021_snapshot.json`
- `components/dashboard/evaluation-template-manager.tsx`
- `components/dashboard/evaluation-template-editor.tsx`
- `components/dashboard/evaluation-templates.module.css`
- `tests/e1b-evaluation-templates.unit.cjs`
- `tests/e1b-evaluation-templates.browser.cjs`
- `docs/FEATURE_E1B_EVALUATION_TEMPLATES.md`

Five incoming protected pending paths remain outside this implementation. Final before/after SHA-256 comparison: **5/5 identical**. Every pre-0021 SQL migration and snapshot is also byte-identical; only the journal receives its authorized appended entry. Branch/HEAD are unchanged and the index remains empty. Scoped whitespace and strict UTF-8 checks PASS. No stage, commit, push, merge, deployment, hosted configuration, database/Storage connection, email or provider operation is performed here.

## Next owner action and E1C prerequisites

Review E1B's source and synthetic visual evidence. Separately authorize disposable PostgreSQL migration/constraint/grant/concurrency validation before database-backed acceptance or publication. Do not use existing Preview records for these tests.

E1C separately needs immutable assessment tables, atomic integration with existing official feedback/confirmation, template-revision/archive checks, explicit rating/N/A-reason rules and denominator calculation using that template's scale maximum (not a hard-coded 4). E1D separately needs Student visibility approval and version-specific finalized reads. Neither phase is implemented or starts automatically.
