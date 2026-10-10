# Owner Gift Editor

Open `/admin` on the database-backed app. This first version uses a single owner
password and encrypted, HTTP-only sign-in cookies through `iron-session`.
It does not require a Supabase Auth account and is not a multi-user permissions system.

## Sign In

Run `pnpm admin:setup` once with a configured `.env.local` file. It creates a
random owner password, a salted scrypt password hash, and a session encryption
secret. The hash and secret are placed in `.env.local`; the generated password
is placed in `.admin-login.local.txt`. Both files are excluded from Git.

Restart the dev server, open `/admin`, and enter the password from the private
login file. Keep this password in your password manager. Never share the private
login file or commit it. No password or database credential is printed by setup.

`pnpm admin:setup --rotate` replaces the owner password and encryption key.
Restart every app instance after rotation; old cookies then stop working.
Existing gift projects are unaffected.

## Edit Projects

- Search or filter the project list. On mobile, use the project selector.
- The Project tab contains title, description, photo, time, cost, and logistics.
- Instructions contains ordered materials, tools, steps, personalization,
  wrapping, shopping categories, and retailers. Each line is stored as one item.
- Matching contains craft requirements, recipients, occasions, feelings,
  and compatible preferences.
- Pattern notes contains finished size, gauge, abbreviations, and pattern notes.
- New gift creates an unsaved draft. Save draft writes it to the database.
- Publish requires a complete project; drafts stay out of public recommendations.
- Save changes preserves the published state. Unpublish makes the project private.
- Discard changes, switching projects, refreshing the library, and signing out
  warn before abandoning unsaved work.
- If another editor tab saved first, the stale tab cannot overwrite it. Refresh
  the library, then reapply the desired changes.

Photo support is an asset picker and HTTPS URL field, not file uploading. Existing
asset paths work directly; custom photos must already be hosted. A broken photo
shows a placeholder in the editor. There is no permanent-delete action in this version.

## Implementation

`src/db/gift-repository.ts` saves a project and its ordered child rows in one
transaction. Each save compares a microsecond-precision update token under a
row lock, so concurrent edits cannot silently overwrite each other.
`src/lib/gift-editor-schema.ts` validates every write on the server.

The owner page and three API routes use `.private.tsx`/`.private.ts` extensions.
`next.config.ts` includes these extensions only in database mode. Consequently,
GitHub Pages and generic static exports contain neither the editor nor its endpoints.
Static previews continue to use starter data and are not live content exports.

Every read/write API checks the owner session. Mutations require a matching
Origin, JSON content, and a body no larger than 128 KiB. Cookies are encrypted,
HTTP-only, SameSite Strict, and Secure in production, with an eight-hour lifetime.
Changing the password hash also invalidates the credential version in cookies.
Invalid or malformed cookies are treated as signed out.

The login limiter permits ten attempts per 15 minutes per server process. This
is appropriate for the current single-process local preview. Before running a
public multi-instance deployment, set `ADMIN_ORIGIN` to the app's exact public
origin, replace the login limiter with a shared limiter, and configure
HTTPS, separate runtime/database roles, secret storage, and database backups.
Use Supabase Auth with role-based authorization when adding multiple editors.

## Verification

`pnpm test:db` covers password checks, session sealing, login limits, publication
validation, draft privacy, ordered updates, and stale-write conflicts, along with
the existing library tests. Browser checks should cover signed-out access,
sign-in, drafting, publishing validation, saving, signing out, and mobile layout.
Use temporary draft projects for live tests and remove only those test records.
