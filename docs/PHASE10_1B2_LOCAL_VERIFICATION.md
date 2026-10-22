# Phase 10.1B.2 local Student verification

This is an optional development experience. Registration, password login, sessions and research access do not require verification. Migration 0012 is already applied to the owner-confirmed isolated local test database; these steps do not generate or apply migrations. Do not use this setup against production or staging.

## Local setup

Mailpit v1.31.6 was downloaded from the official GitHub release, checked against the release asset's SHA-256 digest and extracted into the ignored workspace directory `node_modules/.cache/thesishs-mailpit/v1.31.6/`. No system service, PATH change or administrator installation is used. It must be restored after an operation such as `npm ci` removes that cache.

For another workstation, download `mailpit-windows-amd64.zip` from the [pinned official release](https://github.com/axllent/mailpit/releases/tag/v1.31.6). Compare its `Get-FileHash -Algorithm SHA256` result with the asset digest returned by GitHub's release API, then extract into the same ignored workspace directory. Do not execute an unchecked download or install it globally for this workflow. Mailpit is MIT-licensed; its release license stays beside the executable in the cache.

In one PowerShell terminal, run:

```powershell
npm.cmd run mailpit:local
```

The launcher clears inherited `MP_*` variables and fixes SMTP to `127.0.0.1:1025`, the inbox to `http://127.0.0.1:8025`, allowed HTTP hosts to loopback and recipients to `.invalid`. Relay, forwarding, webhook and update-check options are disabled; reverse DNS and remote message CSS/fonts are disabled. No authentication/production credentials are used. Keep the inbox local because captured links are temporary credentials. Stop this owned foreground process with Ctrl+C. Do not stop someone else's process if a port is occupied.

In a separate terminal for the Next.js development server:

```powershell
$env:THESISHS_LOCAL_MAILPIT = 'enabled'
$env:THESISHS_VERIFICATION_ORIGIN = 'http://127.0.0.1:3000'
npm.cmd run dev -- --hostname 127.0.0.1
```

Set the origin to that server's exact loopback origin. These are opt-in process settings, not secrets; no environment file is committed. A previously running server does not inherit newly set terminal variables. The acceptance runner uses its own port 3031, build directory and configuration, leaving an existing port-3000 server untouched.

Register a disposable Student with an `@example.invalid` address, then open Settings -> Email verification. Request an email, open it in the Mailpit inbox, follow the link and press Confirm my email. The link alone does not verify the account. Confirmation in an anonymous browser creates no session; continue through ordinary password login. A link opened in an already signed-in browser also creates no new session. Only the newest link works. Real personal email remains acceptable for registration, but this local capture adapter deliberately refuses non-`.invalid` recipients.

## Routes and controls

- `/dashboard/student/verify-email`: current active Student's email/status, request/resend, cooldown/quota/recovery guidance and dashboard link. Other roles and anonymous users cannot view another account's status. The sole navigation addition is the Student Settings link.
- `/verify-email`: public confirmation shell. The generated URL uses `#token=...`, so HTTP requests and access-log URLs do not carry the token. Browser code captures and removes the fragment, then the explicit action POST sends it for server-side validation. Same-tab replacement/replayed links reset the form safely, including under development Strict Mode. There is no GET consumption.
- Request/resend accepts no client-selected account/email. Current session and current database account are checked; already-verified accounts receive a controlled completed result. The existing transaction-serialized 60-second cooldown and five-per-rolling-hour policy remain authoritative, including delivery failures.
- Both public mutations require development mode, explicit opt-in and an exact configured loopback Origin/Host. Production refuses them even if its opt-in flag is set. There is no production email fallback, provider SDK or mandatory-verification gate.
- Request-level protection is process-local: at most 120 attempts/minute overall, 60 request attempts/minute across sources, 10 request attempts/minute per account (anonymous callers share a bucket), and 30 confirmation attempts/minute across sources. Forwarded IP headers are ignored; no raw IPs are stored. Buckets expire and the map is bounded. These are fixed-window attempt budgets, separate from the database's rolling-hour issuance quota.

## Confidentiality and remaining production requirements

Verification pages set `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive` and a private/no-store policy. The production GET and POST responses must be tested from the production build. Installed Next.js overrides development page responses to `no-cache, must-revalidate` in `base-server.js`; this local limitation is explicit, not a claimed development no-store result. Confirmation GET HTML never contains a token because fragments do not reach the server.

Next.js development Server Function argument logging is disabled because arguments can contain passwords or verification tokens. Verification-route request logging is also suppressed. No analytics or third-party scripts were added; fonts are served as local assets. Do not manually create query-string token links, log form bodies/SMTP content or capture token-bearing HAR/trace artifacts. Generated links use fragments, but a caller manually placing a token in an HTTP URL can still expose it to external infrastructure; no such URL format is supported.

The raw token necessarily exists briefly in browser memory/a hidden form field and in the local captured message. It is never visible page copy, returned service data or database plaintext. The server alone validates and consumes it. This does not defend against a compromised browser, same-origin script or local inbox access.

The limiter is neither distributed nor a trustworthy per-IP limiter. Shared local budgets can temporarily throttle legitimate local callers. Before production verification or email delivery is approved, select durable abuse controls and a trustworthy ingress identity, review account/session transition and recovery, configure a production sender, and recheck HTTPS, logs, cache headers and token confidentiality. Future Expo needs its own authenticated API/principal boundary; browser Server Actions and cookies are not a mobile API. No bearer/refresh/deep-link work is implemented.

## Focused checks

```powershell
node --import tsx --test tests/phase101b1-email-verification.unit.cjs tests/phase101b1-email-verification-sql.unit.cjs tests/phase101b2-verification.unit.cjs
node --import tsx tests/phase101b2-verification.browser.cjs --confirmed-test-data
npm.cmd run build
node tests/phase101b2-production-http.cjs
```

The database/browser runner verifies local cluster identity and the exact applied 13-entry migration ledger before writes. It creates four uniquely marked synthetic accounts, uses real HTTP actions/password cookies/PostgreSQL/SMTP, ages only its own request timestamps for cooldown/hour tests, and deletes only its own accounts/request rows and Mailpit runtime inbox. Independent row fingerprints verify all pre-existing records. It never applies migrations. Screenshots contain only synthetic status data and stay in ignored `test-results/phase101b2/`; no token-bearing traces are recorded. The dedicated test TypeScript config/build directory avoids interfering with the owner's existing development server, and its temporary generated `next-env.d.ts` reference is restored.

Actual results and exact files belong in the latest Master Context checkpoint. Keep all work unstaged/uncommitted until owner review.

References: [Mailpit installation](https://mailpit.axllent.org/docs/install/), [Mailpit runtime configuration](https://mailpit.axllent.org/docs/configuration/runtime-options/), [Nodemailer SMTP transport](https://nodemailer.com/smtp). Installed Next.js authentication, data-security, cache/header and logging guides were consulted for this version.
