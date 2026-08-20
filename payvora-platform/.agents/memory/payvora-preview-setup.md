---
name: Payvora clean preview setup
description: Environment prerequisites for bringing an imported Payvora checkout to a clean local preview
---

Imported Payvora checkouts may have no installed workspace dependencies even when the lockfile is complete, and the provisioned development database may be empty.

**Why:** The frontend can render while API-backed initialization fails with missing tools or database-table errors, making a superficially healthy preview misleading.

**How to apply:** Install from the existing lockfile, apply the existing development Drizzle schema before testing API-backed routes, and use artifact-owned workflows as the canonical preview services rather than duplicate legacy workflows.