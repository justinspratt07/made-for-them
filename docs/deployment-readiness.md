# Public Server Readiness

The GitHub Pages preview remains a static, starter-data site. It cannot run the
owner editor or read Supabase. A public database-backed deployment needs a
Next.js server, an HTTPS origin, trusted ingress, and separate database users.

## Implemented Controls

- Public and editor connection pools are separate in hosted modes.
- Public database reads are restricted to published gifts and their child rows.
- The editor can read drafts, create and update projects, and replace ordered
  child rows. It cannot delete entire projects or alter the schema.
- Hosted login admission is atomic and stored in PostgreSQL: ten attempts per
  client in a rolling fifteen-minute window. Success resets only that client.
- Client keys are HMAC digests; raw IP addresses are not stored in the counter.
- Missing or malformed trusted identity fails closed rather than using a global
  bucket. IPv6 and IPv4-mapped addresses are normalized.
- Exact owner origin, separate runtime users, TLS configuration, and absence of
  migration credentials are checked before hosted owner access.
- Runtime permission probes reject privileged roles, table ownership, schema
  creation, public writes, and direct access to login counters.
- `/api/health` returns a generic readiness status without connection details.

These controls do not stop distributed guessing across many IPs. Users behind
the same NAT share an allowance. Keep ingress connection/body/time limits and
monitor authentication failures; account-based authentication remains future work.

## Trusted Ingress Contract

Set `APP_DEPLOYMENT=production` and an exact HTTPS `ADMIN_ORIGIN` with no trailing
slash. Set `ADMIN_CLIENT_IP_HEADER` to the single IP header that the chosen
ingress **overwrites**, not one it merely forwards from a caller.

Supported header names are `x-real-ip`, `cf-connecting-ip`, and
`x-vercel-forwarded-for`. Their availability in a hosting product is not a
guarantee of trust: verify that direct backend access is blocked and caller
values are removed/replaced. Never use an arbitrary `X-Forwarded-For` chain.
For nginx, use `proxy_set_header X-Real-IP $remote_addr` only when nginx directly
terminates the visitor connection; any upstream proxy requires a verified
trusted-proxy configuration. Keep the Next.js port private.

The development command binds to `127.0.0.1`. Local mode ignores forwarded IP
headers and allows owner login only for loopback requests. Production servers
cannot opt into local mode.

## Database Provisioning

Use a dedicated Supabase project. Back it up before applying
`0002_deployment_controls`. It creates permission groups, RLS policies, and an
`app_private` schema; it does not change gift content. It also revokes PUBLIC
schema creation and PUBLIC access to the three gift tables. Review this change
before using a database shared with another application.

Run migrations through a separate maintenance job with
`MIGRATION_DATABASE_URL`. Do not include that value in the deployed app.
Provision two login roles with strong independent passwords, using the provider
console or a secure maintenance process:

```sql
CREATE ROLE mft_reader LOGIN PASSWORD 'REPLACE_WITH_GENERATED_READER_PASSWORD';
CREATE ROLE mft_owner_editor LOGIN PASSWORD 'REPLACE_WITH_GENERATED_EDITOR_PASSWORD';
GRANT mft_public TO mft_reader;
GRANT mft_editor TO mft_owner_editor;
```

Neither login role may own tables or inherit administrative authority. Configure
`DATABASE_URL` with the reader login and `ADMIN_DATABASE_URL` with the editor
login, using the same database endpoint and TLS-enabled connection settings.
The app never applies migrations automatically. Keep `app_private` out of any
Data API exposed-schema list; the app uses PostgreSQL directly.

Run `pnpm deployment:check` with private server settings to check runtime roles
and configuration. It does not migrate, seed, publish, or log connection values.
The role model follows [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
and [Supabase role guidance](https://supabase.com/docs/guides/database/postgres/roles).

## Repeatable Verification

```sh
pnpm lint
pnpm test:db
pnpm preview:setup
pnpm test:preview
pnpm build:github-pages
```

Local preview setup uses an ignored PGlite fixture, independent of `.env.local`
and the real database. It runs a separate development server on port 3100 with
its own build directory. Hosted identity isolation at the HTTP boundary is
explicitly skipped locally, not claimed as verified.

In CI, `PREVIEW_MIGRATION_DATABASE_URL` targets only the disposable loopback
`made_for_them_ci` PostgreSQL service. Setup creates random fixture credentials,
migrates, imports 33 gifts, and writes an ignored preview settings file. CI runs
the role preflight, production build, HTTP workflow tests, accessibility checks,
and static build. Fixture credentials are never printed. Traces are disabled to
avoid retaining login request bodies.

The automated accessibility checks cover the quiz, sign-in, and signed-in
editor. Responsive editor checks cover 390, 768, and 1365 pixels. These checks do
not establish full WCAG compliance; keyboard, zoom/reflow, and assistive
technology checks remain release tasks.

## Security Regression

The previous global login allowance could let ten failed requests block another
client's sign-in. Regression tests exhaust client A's allowance, admit client B,
and verify that resetting B does not release A's allowance. Database tests also
exercise parallel admission, expiry, draft isolation, unauthorized writes, and
legitimate editing. Hosted HTTP tests repeat the original trigger using separate
ingress identities against an isolated production-mode server.

## Release Gates Still Requiring Operational Verification

- Successful GitHub Actions and CodeQL runs for the exact candidate commit.
- Human review and approval; automated checks are not peer review.
- A selected host and verified ingress identity/header contract.
- Private runtime secret configuration and rotation procedure.
- Scheduled encrypted backups with agreed retention, and a recovery rehearsal
  into a separate hosted database. A disposable CI pg_dump/pg_restore rehearsal
  verifies fixture content, versions, draft privacy, and restored permissions;
  it does not verify provider scheduling, retention, or live recovery.
- Staging smoke tests with the actual hosting network and TLS termination.
- Keyboard/zoom checks and public deployment approval.

Before migrations, take a provider-supported backup or a `pg_dump` custom-format
backup using private maintenance credentials. Never place its connection URL in
logs or command history; use protected environment/password-file settings.
Store backups outside the repo with restricted access. Restore only into a
separate database and verify gift counts, ordered instructions, drafts, and roles.

Rollback by redeploying the previous app version while preserving the additive
migration. Do not drop data or undo role policies automatically. Disable owner
access if authorization or login protections fail, and fall back to the static
preview if public database reads fail. Any destructive recovery requires a
verified backup and explicit approval.
