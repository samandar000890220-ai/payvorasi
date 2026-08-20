---
name: Payvora AI provider tests
description: Offline testing constraint for Payvora's centralized text-model request layer
---

The canonical text-completion wrapper must remain testable with an injected provider without requiring a configured external AI integration at module-import time.

**Why:** Imported Replit workspaces may have no AI integration attached, while prompt construction, role hierarchy, and streaming behavior still need deterministic validation.

**How to apply:** Keep the production provider load lazy and use a mocked completion creator for request-layer tests; real requests should still fail clearly when the provider is not configured.