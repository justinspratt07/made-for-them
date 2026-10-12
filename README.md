# Made For Them

A handmade gift planner for people who want a thoughtful project that fits their
recipient, occasion, craft interests, skill level, budget, and available time.
The app ranks a curated library using deterministic matching rules and turns
each recommendation into a practical project plan.

[Try the static preview](https://justinspratt07.github.io/made-for-them/)

The public preview uses the starter library. The database-backed app and private
editor require a Next.js server and are not available on GitHub Pages.

## Implemented Features

- Responsive desktop quiz and guided mobile questions.
- Craft selection with a separate skill requirement for each selected craft.
- Ranked recommendations with matching explanations and tradeoffs.
- 33 curated gifts with materials, tools, ordered instructions, personalization,
  wrapping, retailer searches, and project photos.
- Crochet patterns with stitch instructions, gauge, abbreviations, and notes.
- Printable plans, shopping-list copying, sharing, and session-only saved ideas.
- Supabase PostgreSQL persistence through Drizzle, with PGlite for local development.
- A password-protected owner editor with search, drafts, publication checks,
  ordered content editing, and protection against stale saves.
- Automated tests for data integrity, matching, validation, sessions, editing,
  runtime permissions, client identity, and shared login counters.

## Technology

Next.js 16, React 19, TypeScript, Tailwind CSS, PostgreSQL, Supabase, Drizzle,
PGlite, Zod, iron-session, and Lucide icons.

## Run Locally

Install the dependencies:

```sh
pnpm install --frozen-lockfile
```

With no environment settings, the app runs with the starter library:

```sh
pnpm dev
```

For a local database, create `.env.local` using the settings in `.env.example`,
then initialize the library and owner access:

```sh
pnpm db:setup
pnpm admin:setup
pnpm dev
```

Open the URL printed by Next.js. The private editor is at `/admin`; its generated
owner password is in `.admin-login.local.txt`. That file, `.env.local`, and local
database files are excluded from version control.

To use Supabase, select `GIFT_DATA_SOURCE=postgres` and configure the private
database connection. The [database guide](docs/database-setup.md) covers the
schema, migrations, import process, and hosted connection. The
[editor guide](docs/admin-editor.md) covers owner setup and project editing.

## Validation And Builds

```sh
pnpm lint
pnpm test:db
pnpm build
```

`pnpm build` uses the selected data source. Database mode produces a server build.
`pnpm build:static` exports a starter-data preview, and `pnpm build:github-pages`
adds the GitHub Pages base path. Static exports omit the editor and its endpoints.

Desktop and mobile browser checks cover the quiz, gift plans, owner sign-in,
draft saving, publishing validation, and sign-out.

## Current Scope

Saved ideas last only for the browser session. Budgets and times are estimates;
retailer links are searches, not live inventory or tracked affiliate links.
Sharing copies a plan or sends the page link, not a persistent personalized URL.
Photos use existing assets or hosted HTTPS URLs; direct uploads are not implemented.

The editor supports one owner, not a multi-user account system. Hosted login limits
are client-scoped and shared through PostgreSQL; local development uses a bounded
in-memory limit. Hosted modes require separate public/editor database roles and
trusted ingress settings. These changes still require staging and live configuration
before public deployment. Cross-device saved ideas, analytics, payments, and
affiliate tracking remain future work.
See [server readiness](docs/deployment-readiness.md) for deployment controls and gates.
The [Render setup guide](docs/render-setup.md) covers a free testing service and
private settings. `render.yaml` is configuration only; no Render deployment is live.
See the [action plan](docs/action-plan.md) for the roadmap and diagrams.

Author: [Justin Spratt](https://github.com/justinspratt07)
