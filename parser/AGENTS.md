# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains a Node.js scraper/parser service in `scraper/`.
Core runtime code lives in `scraper/core/`: scheduling, Telegram ingestion,
normalization, and delivery to RAG. Source plugins live in
`scraper/plugins/web/` and `scraper/plugins/tg/`. Enabled plugin lists are
configured in `scraper/config/sources.js`. The service entry point is
`scraper/index.js`. Environment defaults are documented in
`scraper/.env.example`.

Tests are not yet present. When adding them, place focused unit tests near the
module they cover or under a dedicated `scraper/tests/` directory.

## Build, Test, and Development Commands

Run commands from `scraper/`:

```bash
npm install
npm start
npm run dev
node --check index.js
```

`npm install` installs service dependencies. `npm start` runs the scraper once
as a normal Node process. `npm run dev` starts Node in watch mode for local
development. `node --check` validates JavaScript syntax without starting the
service.

## Coding Style & Naming Conventions

Use ESM syntax only: `import` and `export`. Keep modules small and focused on a
single responsibility. Use 2-space indentation, semicolons, and descriptive
camelCase names for functions and variables. Plugin files should use kebab-case,
for example `plugins/web/city-news.js`, and export a default object matching the
web or Telegram plugin contract.

## Testing Guidelines

No test framework is configured yet. Prefer adding a lightweight Node-compatible
test runner before introducing broad changes. Test normalizers, plugin parsing,
queue retry behavior, and scheduler integration with mocked plugins. Name tests
after the behavior under test, for example `normalizer.test.js`.

## Commit & Pull Request Guidelines

Git history could not be inspected in this sandbox because the parent repository
is marked as unsafe for the current user. Until a project convention is
available, use short imperative commit messages such as `Add Telegram scraper
skeleton`. Pull requests should include a summary, configuration changes,
testing performed, and linked issues when applicable.

## Security & Configuration Tips

Do not commit real Telegram credentials or session strings. Copy
`scraper/.env.example` to `.env` locally and set `TG_API_ID`, `TG_API_HASH`,
`TG_SESSION`, and `RAG_URL`. Keep example plugins safe and non-destructive; real
plugins should handle network errors and return only normalized content needed
for ingestion.
