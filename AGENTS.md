# Repository Guidelines

## Project Structure & Module Organization

Zoe is a Bun/Turbo TypeScript monorepo for Path of Exile 2 tools:

- `apps/api`: Fastify HTTP API, trade endpoints, and `src/*.test.ts` tests.
- `apps/desktop`: Tauri + Vite React overlay; Rust backend lives in `src-tauri`.
- `apps/web`: Next.js app in `app/`.
- `apps/worker`: CLI jobs for ingestion, summaries, and heatmaps.
- `packages/domain`: shared PoE2 domain, parser, and trade logic.
- `packages/api-client`, `packages/config`, `packages/db`, `packages/ui`: shared client, env, database, and UI modules.

Generated output belongs in `dist/`, `.next/`, `.turbo/`, or `apps/desktop/src-tauri/target/`; do not edit it by hand.

## Build, Test, and Development Commands

Run commands from `D:\Dev\zoe`.

- `bun install`: install workspace dependencies.
- `docker compose up -d postgres`: start local Postgres.
- `bun run dev`: run all persistent dev tasks.
- `bun run dev:api`, `bun run dev:web`, `bun run dev:desktop`, `bun run dev:worker`: run one app.
- `bun run build`: build all packages and apps.
- `bun run build:desktop`: build the Vite desktop renderer.
- `bun run typecheck`, `bun run lint`, `bun run test`: run repo-wide checks.
- `bun run test:api`, `bun run test:desktop`, `bun run test:domain`: run scoped tests.
- `bun run worker:*`: run operational worker jobs.

For the overlay, `dev:desktop` launches `tauri dev`; `dev:desktop:renderer` is Vite-only.

## Coding Style & Naming Conventions

Use TypeScript ESM and React function components. Prettier uses 100 columns, semicolons, double quotes, and no trailing commas. ESLint errors on unused variables unless prefixed with `_`. Use PascalCase components and camelCase functions/variables.

## Testing Guidelines

Vitest is the default runner. Place tests beside implementation as `*.test.ts` or `*.test.tsx`. Add focused tests for parser, trade query, API, and worker behavior. Mock trade network responses.

## Commit & Pull Request Guidelines

This repository has no commit history, so use an initial convention: imperative, scoped commits such as `desktop: fix overlay hotkey gating` or `api: normalize trade listings`. PRs should include a summary, tests, linked issues, and screenshots for visible desktop/web changes.

## Reference Documentation

- Bun workspaces and scripts: https://bun.sh/docs
- Turborepo tasks and filters: https://turborepo.com/docs
- Tauri v2 desktop shell: https://v2.tauri.app
- Next.js app router: https://nextjs.org/docs
- Vitest: https://vitest.dev

## Agent Tooling Notes

When working through Codex, use `tool_search` to discover MCP-style tools. Useful options here include GitHub for PR/issues, Browser for app checks, Computer Use for Windows checks, Node REPL for JavaScript inspection, and Codex app tools for threads or automations. Prefer `rg` for repo searches.
