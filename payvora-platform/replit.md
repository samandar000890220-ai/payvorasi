# Payvora

Payvora is a fintech-inspired AI workspace with chat, voice, image, and video creation tools.

## Run & Operate

- After importing or restoring the workspace, run `pnpm install --frozen-lockfile`; initialize the development database with `pnpm --filter @workspace/db run push` before using database-backed chat routes.
- `pnpm --filter @workspace/payvora run dev` — run the Payvora web app (requires `PORT=5173 BASE_PATH=/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (requires `PORT=8080`)
- `pnpm --filter @workspace/mockup-sandbox run dev` — run the component preview server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The configured `Payvora web` and `Payvora API` workflows provide preview routing on the supported `5173` and `8080` ports; use the root Preview URL (without `:5173`) because the Replit preview router owns the external URL.
- The API server requires the workspace's configured database environment when database-backed routes are used.
- Realtime composer voice requires a genuine server-side provider via `REALTIME_PROVIDER`; this checkout has no provider configured. Do not use `loopback` for acceptance testing because it is the existing deterministic test simulator, not real transcription.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/payvora/src/App.tsx` — Payvora shell, sidebar, chat workspace, and responsive navigation
- `artifacts/payvora/src/index.css` — global layout, sidebar tooltip, and responsive rules
- `artifacts/payvora/src/voice-studio/` — Voice Studio shell, pages, shared controls, and visual tokens
- `artifacts/api-server/` — shared Express API service
- `lib/api-spec/`, `lib/api-client-react/`, and `lib/api-zod/` — API contract and generated client packages

## Architecture decisions

- Payvora remains a pnpm workspace and keeps the imported React + Vite structure intact.
- The sidebar uses one navigation configuration; collapsed mode filters it to essential controls rather than duplicating navigation.
- Voice Studio keeps its existing visual card design and uses CSS grid sizing for equal five-card desktop rows with responsive fallbacks.
- Payvora uses the configured web/API workflows so the Vite server stays pinned to the supported internal `5173` port and the API stays on `8080`.

## Product

- AI Chat workspace with chat history and quick actions
- Voice Studio with text-to-speech, voice selection, voice cloning, saved voices, and history views
- Image, video, document, agent, template, knowledge-base, project, and integration workspace navigation
- Responsive expanded/collapsed sidebar with accessible labels and tooltips

## User preferences

- Do not recreate or redesign the Payvora page or its existing components. Preserve the uploaded design and structure unless the user explicitly requests a design change.

## Gotchas

- Run Vite builds with `PORT` and `BASE_PATH` set, or use the configured `Payvora web` workflow.
- Open the root Preview URL rather than a direct `:5173` URL; restart the affected workflow after dependency or runtime changes.
- The home composer attachment menu uses native file pickers and real local `File` objects for preview/removal. The existing text-only chat API is unchanged, so binary attachment upload to persisted chat messages is not claimed as connected.
- Keep the uploaded Payvora and Voice Studio reference designs intact unless a request explicitly asks for a visual redesign.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
