---
name: Payvora ChatGPT-style shell
description: The app shell is redesigned to mimic the ChatGPT iOS app; design rules for future shell/UI work.
---

# Payvora shell = ChatGPT iOS look (Aug 2026 redesign, user-requested)

The rule: the shell (sidebar, header, home empty state, composer) must keep the ChatGPT-mobile look — sliding sidebar with overlay ("Payvora" title + search, Images/Library/Projects/More menu, Recents chat list, blue Chat pill + gear at bottom), minimal empty home with bottom action list and pill input, hamburger + Upgrade pill + history icon header.

**Why:** User supplied ChatGPT app screenshots and a detailed spec and asked for an exact match while keeping all functionality. The old dashboard (greeting, studio cards, quick chips, right rail) was intentionally removed; usage lives on Billing, studios are reached via the sidebar.

**How to apply:**
- Accent for shell CTAs is `--pv-blue` (#0A84FF); `--pv-brand` (orange) still exists for legacy page styles.
- Themes are pure white / pure black; nearly all grayscale colors in index.css were converted to `--pv-*` vars — never hardcode light grays (#fff bg, #111827, #6b7280, #e5e7eb) in new CSS; use the vars so dark mode works.
- Honesty contract still applies: unavailable controls (web search, attachments, mic) are visibly muted, show "Not available yet", and toast the reason on tap — keep that pattern.
- ChatPanel's internal conversation aside is hidden ≤760px (`.chat-conv-aside`); app-sidebar Recents covers switching on phones.
- React 18: no `inert` prop — set `el.inert` via callback ref (see `inertWhen` in App.tsx).
- Hybrid shell (user-chosen): ChatGPT-style home/chat kept, sidebar is a grouped enterprise fintech nav (Workspace / AI Studio / Knowledge & Automation / Account); "Dashboard" = the AI home, "Library" = /documents.
- Unified accent is blue: `--pv-brand` defaults to blue, but ThemeProvider overrides it with the persisted accent from Settings — stored accents (incl. orange) are deliberate user picks and must never be auto-migrated.
- Palette (user-specified): primary #3C8CFF, accent #7C3AED, light page #F8F9FB w/ white cards, dark #1A1A1A page / #252525 cards (no longer pure black). Solid blue button fills must use `--pv-blue-strong` for WCAG contrast; studio card tints via `--pv-tint-*` vars.
- /ai-studio command center: Voice card status chip comes live from `/voice/capabilities` (configured+reachable) — never hardcode service availability claims.
- ChatPanel's remount key must be a session counter, never the conversation id — the id arrives mid-stream and an id-based key remounts the panel and double-sends the first message.
- Home composer has modes (Create an image / Write or edit) matching the reference recording; image mode hands the prompt to Image Studio via its `initialPrompt` prop (generation there stays honestly gated on a provider).
