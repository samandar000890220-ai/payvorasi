---
name: Monorepo typecheck order
description: TypeScript project-reference gotcha for the db package
---
Run `pnpm exec tsc -b lib/db` from the workspace root before typechecking `@workspace/api-server`.

**Why:** lib/db has no build script; api-server uses project references and fails with missing declaration files if lib/db's .d.ts output is stale.

**How to apply:** any time schema files in `lib/db/src/schema/` change, rebuild lib/db first, then `pnpm --filter @workspace/api-server exec tsc --noEmit`.
