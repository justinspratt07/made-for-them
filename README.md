# Made For Them — Handmade Gift Planner

A Next.js, React, and TypeScript prototype that helps users choose a handmade gift from a curated project library. The quiz considers recipient, occasion, craft interests, skill comfort, budget, time, and preferred style. Rule-based scoring ranks ideas and explains matches and tradeoffs.

## Features

- Desktop quiz and guided mobile questions.
- Ranked idea collections and detailed project plans.
- Materials, steps, personalization, wrapping, and retailer search links.
- Session-only saved ideas, print, copy, and browser sharing controls.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Next.js. Use `pnpm lint` and `pnpm build` to validate the app. `pnpm build:github-pages` produces the static Pages export.

## Scope

Personal portfolio prototype. Matching uses a local curated library and deterministic rules, not a generative AI service. Saved ideas reset on refresh. Budgets and times are estimates; retailer links are searches rather than live inventory. Sharing sends the page URL and description, not a persistent personalized plan. No accounts, checkout, paid subscriptions, or cross-device synchronization are implemented. See `docs/action-plan.md` for the development roadmap.
