# Restricted Database Access Preparation

The hosted app uses two login accounts:

- `mft_reader` inherits only the published-library read permissions in `mft_public`.
- `mft_owner_editor` inherits the draft/edit permissions in `mft_editor`.

Neither account is a database administrator. The maintenance connection remains
private and must not be added to Render.

## Verified Preparation

On October 12, 2026, the dedicated Supabase application database was checked
read-only: PostgreSQL 17.11, 33 published gifts, and only the three gift tables in
the public schema. Before changing permissions, an application backup of the
`public` and `drizzle` schemas was taken using matching PostgreSQL tools.

That backup was restored into a temporary localhost-only database. All application
rows, timestamps, and ordered content matched the live source fingerprint. The
permission migration and new login accounts were tested against that restored
copy before applying them to Supabase. The live reader/editor accounts then
passed the runtime permission probes and read checks; all 33 gift records remained
unchanged. Three migrations are now applied. The temporary database was stopped
and its plaintext scratch files removed.

The backup is protected with Windows CurrentUser DPAPI and stored outside the
repository. Its protection round-trip was checked. Recovery requires the same
Windows account's protection keys; this is not a portable, independently keyed
off-site backup. Keep account/machine recovery available and arrange a portable
off-site backup before relying on a public production service.

Scope limitations:

- This is an application-schema backup, not a full Supabase Auth/Storage backup.
- Original ownership/ACL restoration was not tested; the local rehearsal skipped
  those platform-specific settings. The archive preserves them for manual review.
- New runtime permissions were independently verified against both the restored
  copy and the actual Supabase accounts.
- No Render service was created and no GitHub PR was merged by this operation.
- Scheduled backups, actual hosting ingress, and manual accessibility checks
  remain separate release gates.

## Private Render Values

The verified values are in `render-runtime.env` in the protected preparation
directory, not in the repository or `.env.local`. Enter its four values into
Render individually:

```text
DATABASE_URL
ADMIN_DATABASE_URL
ADMIN_PASSWORD_HASH
ADMIN_SESSION_SECRET
```

Do not paste values into chat, screenshots, commits, or pull request descriptions.
Do not copy the original maintenance connection to Render. The owner password
hash was retained, while Render receives a separate newly generated session key.
The existing `.env.local` was not overwritten.

## Maintenance Tools

`scripts/database-inspect.ts` performs read-only version/count/capability checks
without printing credentials or gift contents.

`scripts/prepare-database-access.ts` is an explicitly approved Windows maintenance
operation, not part of deployment or app startup. It requires:

```text
POSTGRES_TOOL_DIRECTORY       Portable PostgreSQL bin directory
DATABASE_PREPARATION_DIRECTORY New protected directory outside the repository
```

It refuses unexpected application tables or existing runtime roles rather than
replacing passwords. Do not rerun it on this prepared database. Future password
rotation requires a separate reviewed operation.

The preparation command backs up and restores before applying permissions,
uses locally generated SCRAM verifiers so plaintext role passwords do not enter
live DDL, verifies both actual login roles, and marks the private settings verified
only after those checks pass. A pending settings file is retained if a later
step fails; it must not be used until verified. Diagnostics stay in the protected
directory, not in logs.

For setup and publication gates, continue with [Render Setup](render-setup.md).
