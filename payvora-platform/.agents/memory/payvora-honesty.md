---
name: Payvora honesty contract
description: Governing UX contract for the Payvora platform — what must stay honest and what is intentionally not connected.
---

Rule: every visible control must be genuinely functional OR disabled with a visible reason. No fake data, fake success, or placeholder AI.

**Why:** user's explicit zero-tolerance contract; violations were treated as failures in review.

**How to apply:**
- AI: only `gpt-5.6-terra` via Replit OpenAI integration (`max_completion_tokens`, no temperature). Model pickers must not list other models as selectable.
- Billing is internal-only: plan changes are free during preview, labeled "no payment required yet — payments are not connected". Never add fake payment forms.
- Webhooks: only manual test delivery exists; no automatic event dispatcher — copy must say so.
- API keys are real (SHA-256 hashed, verify endpoint) but no API gateway authenticates with them yet.
- Sign Out disabled (anonymous cookie session, no auth). Voice Studio/F5-TTS must never be redesigned or replaced.
- Rendered rich-text/AI HTML must pass through `src/lib/sanitize.ts` (XSS); webhook test delivery has an SSRF guard (private-IP block) in the integrations route.
