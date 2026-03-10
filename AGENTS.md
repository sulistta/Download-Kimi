# Repository Guidelines

## Project Structure & Module Organization
This project is a Next.js 14 App Router app for serving KimiTV download information. Use `app/` for routes and page-level UI, including the catch-all API handler at `app/api/[[...path]]/route.ts`. Shared presentational components live in `components/ui/` and follow the shadcn/Radix pattern. Put reusable hooks in `hooks/` and small helpers in `lib/`. Backend smoke tests are in `backend_test.py`; `tests/` is available for additional Python test modules. Keep generated artifacts and ad hoc test output in `test_reports/` instead of source folders.

## Build, Test, and Development Commands
- `bun run dev`: start the local dev server on port `3000`.
- `bun run dev:no-reload`: run the same app without the reduced-memory `NODE_OPTIONS` wrapper.
- `bun run build`: create the production Next.js build.
- `bun run start`: serve the production build locally.
- `bun run typecheck`: run the TypeScript compiler without emitting files.
- `python3 backend_test.py`: run API smoke tests against `NEXT_PUBLIC_BASE_URL` from `.env` or `http://localhost:3000`.

## Coding Style & Naming Conventions
Match the existing code style before introducing new patterns. Frontend files use modern React function components, 2-space indentation, and semicolons in the `app/` code. Name React components with `PascalCase`, hooks with the `use...` prefix, and helper functions in `camelCase`. Keep route files lowercase (`page.tsx`, `layout.tsx`, `route.ts`). Prefer the existing import aliases such as `@/components`, `@/hooks`, and `@/lib`. Tailwind utility classes are written inline; keep class groups readable and avoid large formatting-only diffs. No ESLint or Prettier script is configured, so contributors should self-check consistency.

## Testing Guidelines
There is no unit-test framework wired into `package.json` yet. For API changes, start the app locally and run `python3 backend_test.py`; it covers `/api/releases`, `/api/health`, and invalid-path behavior. Add new backend checks near the existing endpoint-focused functions, and place broader Python tests under `tests/` using `test_*.py` naming. No coverage gate is enforced, but changes to API logic should include happy-path and error-path verification.

## Commit & Pull Request Guidelines
Recent history is minimal (`Initial commit` and auto-generated UUID commits), so prefer short, imperative commit messages such as `Add cached fallback for releases API`. Keep one logical change per commit when possible. PRs should include a brief description, local test steps, linked issues if applicable, and screenshots or screen recordings for UI changes. Call out any `.env` or header/CORS changes explicitly.

## Security & Configuration Tips
Do not commit real secrets in `.env`. Review `next.config.js` carefully when changing CORS or security headers, and verify `NEXT_PUBLIC_BASE_URL` before running smoke tests against a shared environment.
