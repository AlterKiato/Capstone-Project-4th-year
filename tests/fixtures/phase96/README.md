# Phase 9.6 Gate A.2a: offline fixture preparation design

Implementation and dry-run validation only. Phase 9.6 remains OPEN. This utility
is **not provision-ready**. Gate A.2b requires separate owner authorization and
a reviewed implementation change. No flag or environment variable enables writes.

Run from the repository root:

```powershell
node tests/fixtures/phase96/prepare.cjs
node tests/fixtures/phase96/prepare.cjs inspect
node tests/fixtures/phase96/prepare.cjs dry-run
node --import tsx --test tests/fixtures/phase96/fixture-core.unit.cjs
node tests/fixtures/phase96/prepare.cjs provision
```

The last command intentionally exits 1 with `PROVISIONING_NOT_AUTHORIZED`, before
configuration/files are read or any adapter can be constructed. Unknown commands
and extra arguments also fail closed. Successful offline inspection exits 0; that
means configuration supports planning, **not** that a live target is certified.

## Boundaries and configuration

- `prepare.cjs` reads root `.env` with `dotenv.parse`, then applies process-environment
  overrides, matching existing CLI conventions. It does not load `.env.local` or
  expand environment substitutions. Resolve differences with a future Next server's
  effective configuration before A.2b; never assume CLI and server targets match.
- Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Only key presence
  is checked; no key validity or permissions claim follows. No URL/key is printed.
- Only local development/test invocation: no production/unknown `NODE_ENV`, CI or
  Vercel context. PostgreSQL must explicitly use port 5432, database `thesishs_ai`,
  and localhost/127.0.0.1/IPv6 loopback. URL query overrides/fragments are rejected.
  Obvious production/live account markers are rejected; markers alone never prove isolation.
- Storage configuration must be an unambiguous HTTPS Supabase project origin with
  a 20-character project ref. Other/custom origins fail closed. Bucket is fixed as
  `research-submissions`. This is shape validation; a different well-formed project
  needs an independent pin and will fail the future observed-target comparison.
- Reads the 12 repository migration SQL files in journal order and hashes their exact
  bytes. No migration runner or application module is loaded. Repository hashes do
  not prove applied database state. Windows SQL line endings must match the applied
  ledger; any discrepancy requires investigation rather than normalization/guessing.
- Reports only secret-free configuration/migration fingerprints and symbolic resource
  templates. No database/storage client, network call, object listing, upload, deletion,
  signing, download, credentials, PDFs or ownership manifests are persisted.

The owner declares the configured DB and Storage project exclusively development/test,
with no real student or production data. This is an authorization assumption, not
runtime identity evidence. Historical fixtures remain unowned and must stay untouched.

`validateRuntimeTarget` is a pure, synthetic-tested contract for A.2b, not a live probe:
an independently reviewed external target pin must bind configuration fingerprint,
project ref, bucket, PostgreSQL system identifier, database OID and catalog digest.
Future bounded read-only observation must verify actual server address (including
`::1/128`, never a hostname-only assertion), port/database, PostgreSQL 18.4, exact
ordered 12 applied hashes, expected constraints/indexes/role seeds, private bucket and
project identity. Catalog digest construction and live observation are not implemented.
Ambiguous/missing privileges or identity => stop. Recheck immediately before writes.
Require at least 10 ordinary available connection slots after all reserved slots,
existing clients and the observer; review the future browser/server budget too.
Any future observer must use one bounded read-only connection, statement/lock/connect
timeouts and awaited `finally` shutdown. There is no live observer in this gate.

## Fixture relationships and application interfaces

Preparation plans exactly three new active accounts (Admin 1, Adviser 2, Student 3),
one active Adviser-owned group, one Student membership, and one fresh Draft paper.
Membership has no status column; active membership derives from its active group.
Required nonempty fields and FK order follow the current schema. Group strand is
`SYNTHETIC`, section `TEST`, school year `2026-2027`; title/abstract clearly say synthetic.
Multiple projects per group remain permitted; only one is prepared. No submission,
feedback or publication is seeded. Panel evaluation and Groq remain excluded/disabled.

1. Independently pin targets and create an exclusive private per-run journal first.
2. Proposed bootstrap: insert **one new** active Admin through a separately reviewed
   test-only transaction, validating registration fields and role seed 1, using existing
   `hashPassword` (bcrypt cost 12), unique email and returned ID. This exception is needed
   because `createManagedAccount` requires an existing authenticated active Admin and
   public `registerUser` forces Student. No promotion/reset/reuse of historical accounts,
   auth bypass route, eligibility certification or active bootstrap exists here.
3. Owned Admin session uses `createManagedAccount` through existing validated account
   action for Adviser. Student uses validated public registration/`registerUser`.
4. Owned Adviser uses `createResearchGroupAction`/`createResearchGroup`, then
   `addGroupMemberAction`/`mutateAdviserGroupMember`. Preserve active-account, own-group
   and one-active-membership checks. Do not call the lower-level membership service
   directly and omit its owning authorization wrapper.
5. Owned Student uses `createStudentResearchAction`/`createStudentResearch`; verify
   returned paper ID, owned group, Draft and **zero** previous submissions.
6. Prepare two private local PDFs. Stop before the actual acceptance workflow.

Primary preparation inserts: users=3, research_groups=1, group_members=1,
research_papers=1 (six rows). Existing group service additionally inserts one activity
log and N notifications, where N is every existing Admin selected by
`findUsersByRoleId`, including historical accounts. This fan-out needs an owner
decision before A.2b under the historical-data preservation requirement. Do not
silently suppress service behavior or replace group/project services with direct SQL.
Group creation can commit before logging/notification failure, and its action does not
return the group ID. Exact returned creation evidence/uncertain-outcome reconciliation
must be designed before writes; a title/email lookup is never ownership certification.

Later browser acceptance must perform v1 -> Start Review -> Revision Required -> v2
-> Start Review -> Approved -> Admin publication, preserving all version-specific
feedback and history. That workflow and its writes are outside preparation scope.

## PDFs and paths

`pdfBytes` produces memory-only, deterministic PDF 1.4 documents: one page, Helvetica,
visible `SYNTHETIC TEST ONLY` draft/revised text, correct stream length, xref offsets,
catalog/page tree and EOF. MIME is `application/pdf`; v1=612 bytes and v2=614 bytes,
well below 10 MiB. The dry run reports full SHA-256 checksums. No random metadata or
real institution/student content. Unit checks independently inspect offsets/structure
and compare planned paths to the actual `isSubmissionDocumentPath` validator.

Future file names: `{runId}-v1.pdf` and `{runId}-v2.pdf`. The existing uploader derives
`research/{ownedPaperId}/v1/{runId}-v1.pdf` and the corresponding v2 path with
`upsert:false`; no new top-level namespace. Submission/storage writes occur only
through the authorized workflow, not by calling `storagePath` or `pdfBytes`.

## Credentials and private ownership journal

Generate future run IDs with `randomUUID` (hyphens removed, prefixed `phase96-`).
The fixed all-zero preview run is non-owning and rejected by manifest validation.
Each future account needs independent cryptographic random credentials (proposed
`randomBytes(32).toString('base64url')`, within validation and bcrypt byte limits).
No persistent credentials are generated now. No password/hashes/tokens in logs,
manifest or repository files. The proposed future secret mechanism is an OS-protected
credential store keyed by run/role, read directly by the authorized browser harness
without printing. Owner approval and implementation of that mechanism remain pending;
do not fall back to a plaintext repository file, command-line argument or ordinary journal.

Proposed journal location: owner-approved private directory **outside the checkout**,
e.g. `%LOCALAPPDATA%/ThesiSHS-Acceptance/phase96/{runId}/ownership.json` with restrictive
Windows ACLs. Outside-repository storage is not a substitute for ACL/integrity checks.
No directory/file is created by this gate and no new gitignore rule is needed.

`validateManifest` implements a strict version-1 **shape/consistency contract**:
run ID, secret-free environment fingerprint, timestamps and 12 fixed resource slots
(three account IDs, group ID, membership ID, paper ID, two PDFs, two future submission
IDs/versions and two future owned object paths). All slots bind to the run and explicit
parent slots. PDF checksums are fixed. Creation proof/verification timestamp fields
record step evidence; the private future journal must keep the underlying restricted
evidence separately and verify its digest. Unknown fields, wrong ownership, duplicate
IDs/slots, unexpected parents/paths, missing proof and false planned/cleanup claims
fail closed without echoing input. States are planned, created, verified,
pending-cleanup and deliberately retained. Planned IDs/object paths remain absent.

This validator alone cannot authorize resumption or cleanup. The future implementation
must exclusively lock the run; validate ACLs, target pin and journal integrity; reread
recorded IDs/roles/FKs/version/path/checksum against the target; refuse any conflicting
or uncertain creation; resume owned incomplete steps only. Never adopt matching titles,
emails or test-looking records. Persist intent before writes and exact returned creation
receipts atomically afterward. A crash between database commit and journal receipt is
an unresolved ownership gap: stop, retain and investigate, never blindly retry/delete.
No cross-service transaction or automatic rollback is claimed.

Cleanup is not implemented. A separately reviewed journal extension must track every
owned downstream feedback/repository/activity/notification ID, including fan-out,
before later workflow writes. Eventual cleanup requires separate authorization and
fresh ownership/target checks; delete only individually recorded owned objects matching
paper/version/run filename and checksum, never prefixes/bucket sweeps or unowned rows.
Respect restrictive FKs, delete in reverse dependency order, and retain uncertain resources.

## Verification and remaining gate

Unit tests use synthetic definitions and read mocks, with traps for client imports,
network and filesystem mutations. They do not run a database, Storage, application
server, workflow, migration or browser. Inspect/dry-run remain static; live headroom,
actual private bucket and instance/schema identity are deliberately unverified here.
No live before/after database fingerprint claim is made because no connection is opened.

Next decision: review the design, resolve bootstrap/notification ownership/credential
handoff and target pins, then separately authorize A.2b implementation and exact
provisioning scope. Do not enable provisioning simply by setting a flag.

## Gate A.2b-I implementation: mock-only, native adapters unavailable

The CLI now reports Gate A.2b-I and implementation availability. Default inspect and
dry-run remain offline. Provision still refuses before configuration reads or runtime
imports, including ALLOW_TEST_PROVISIONING=1, --force, --confirm and --enable attempts.
Direct execution of the two new implementation modules also refuses. No activation
switch or second provisioning executable exists.

```powershell
node --import tsx --test tests/fixtures/phase96/fixture-core.unit.cjs tests/fixtures/phase96/provision-runtime.unit.cjs
```

- `fixture-core.cjs`: strict version-2 pins/observations and `validatePinnedTarget`.
  The older A.2a comparison/12-slot manifest remain offline compatibility contracts;
  they cannot admit the new orchestration by themselves.
- `provision-runtime.cjs`: non-executable `runMockProvisioning` and bounded cleanup
  contracts. Only explicit injected memory adapters and synthetic permits are
  accepted. These labels are test assertions, not live authorization capabilities.
  No application, database, Storage, filesystem or process adapter/default is loaded.
- `private-state.cjs`: authenticated journal, exclusive lock, external-path/security
  metadata validation and CurrentUser-compatible protected-state interfaces.
  `nativeProtection()` always throws NATIVE_PROTECTION_UNAVAILABLE.
- `provision-test-doubles.cjs`: deterministic in-memory service/auth/transaction,
  persistence and process doubles. Its reversible encoding is NOT encryption/DPAPI.
  Fixed password/key/hash sentinels have no application accounts.
- `provision-runtime.unit.cjs`: focused mock tests; the original eleven-test source
  remains unchanged.

Pins compare exact host/database/port, cluster ID/database OID, PostgreSQL version,
current/session role, approved role attributes and privileges, application role IDs,
actual role rows, ordered 12 migration hashes and canonical schema digest. Loopback
normalization supports ::1, ::1/128, full IPv6 and equivalent IPv4-mapped 127.0.0.1.
Remote/private addresses and other masks fail. Legacy role-3 label User is permitted
only when explicitly pinned/observed; never run the inconsistent historical seed.
Storage requires the exact HTTPS project origin/ref, private research-submissions
bucket and current path convention, matching supplied effective server configuration.
No fallback, signing, upload, deletion or live metadata request is implemented.

Connection capacity uses observed max_connections, both reserves, client backends
including the observer, role/database limits and counts, and planned client demand;
>=10 spare ordinary slots are required afterward. Historical 100/3 values are not
runtime constants. Missing metadata fails closed. Observer contract: max=1,
2-second connect timeout, 3-second statement/work deadline and independently bounded
5-second cleanup. These are injected mock contracts, not real driver/process proof.

Bootstrap models registration validation, distinct injected passwords, protected-state
save/read verification, the existing bcrypt cost-12 interface, a unique normalized
run email, role 1 and a single insert transaction. Returned IDs become confirmed only
after commit returns; lost commit responses are uncertain, acknowledged rollback is
separate. No promotion/reset, role change or AI-governance write exists.

Real service integration is deliberately unavailable. Adapter mappings to implement
later: createAdviser -> createManagedAccount; registerStudent -> registerUser;
authenticate -> loginUser; createGroup -> authorized/validated group action/service;
addMembership -> mutateAdviserGroupMember; createProject -> Student action/service.
Adapter receipt callbacks/envelopes are NEW contracts, not existing application API
fields. Fakes represent current validation/auth behavior; they do not execute real
services or prove production authorization. No loader interception, session/cache
shim, application route or production source change has been introduced. A safe
reviewed bridge must preserve real validators, hashing, authorization and exact
repository-returned IDs. Until then live provisioning is not ready.

Group modeling preserves group -> Adviser audit -> all selected Admin notifications,
including historical/inactive recipients and concurrent Promise.all fan-out. Each
primary/secondary write receives its own durable intent, returned ID and independent
verification. Swallowed notification failures stop ready status without rolling back
or retrying the committed group. Actual fan-out requires separate execution approval.

Journal records bind run/target, payload digest excluding credentials, step/attempt,
exact IDs/parents, evidence, timestamps and planned/started/returned/verified/failed/
uncertain state. HMAC chaining uses a separate protected key; a separately protected
sequence/MAC cursor detects whole-tail truncation. Plain SHA-256 is not integrity
authorization. Synchronous append-and-flush/cursor interfaces serialize receipts;
unawaited Promise-returning persistence is rejected. Flush/cursor failure poisons the
instance. Journal/cursor storage is not claimed to be one atomic transaction.

Protected credential-state creation itself has intent/returned/verification records;
only ciphertext digest/length are journaled. The journal key must match the key
protected with credentials. Admin IDs returned before a lost commit response are
recorded as unconfirmed candidates, never as verified owned resources. Independent
verification compares expected field digests as well as exact IDs/relationships;
the fresh-project contract includes Draft status and a derived zero-submission count.

Resume supports READ-ONLY inspection only: validate HMAC/cursor/run/target/transitions,
unique IDs and owned parents, then require independent target reads. No automatic
retry/adoption/teardown exists. Uncertain commits or unjournaled IDs require manual
review; matching names/email patterns are insufficient. Resource retention states in
the legacy manifest remain separate from operation states.

Private paths use LOCALAPPDATA/ThesiSHS-Acceptance/phase96/{targetFingerprint}/{runId}
outside the checkout. Checks require current-user SID ownership, restricted explicit
ACLs, no target/ancestor reparse points and exclusive ciphertext creation. CurrentUser
protection, private-pipe transfer and cursor/key protection are adapter contracts.
Native DPAPI, actual ACL inspection, durable disk/locks and PowerShell pipe/process
safety have not been demonstrated. Therefore no real protector or protect-state.ps1
is supplied. Missing/decryption failures stop; there is no plaintext fallback.

All credential/journal/PDF/database/process effects in tests exist only in fake memory.
Original 612/614-byte PDF definitions/checksums/application paths are unchanged.
Real account/session invalidation and reverse-FK cleanup need separate authorization;
deleting ciphertext alone would not revoke accounts or sessions.

Next: owner reviews this mock implementation and missing native/service integration.
Gate A.2b-E still requires reviewed live admission, completed safe adapters, independent
target pins, approved credentials/journal mechanism and historical-Admin fan-out scope.
Gate B remains separate. Phase 9.6 remains OPEN; owner acceptance is pending.
