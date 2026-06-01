## Why

The marketing landing page (`applications/landing`) presents a polished dark-themed identity with the indigo→cyan accent system, Inter typography, and glow accents, while the authenticated console (`applications/console`) ships a generic light-themed Tailwind look with purple buttons and per-page inline styles. The visual mismatch breaks brand cohesion at the most important hand-off point (sign-up CTA → first console screen) and signals lower product quality than the marketing surface promises. The console functionality is solid; only the surface needs to catch up.

## What Changes

- Introduce a console-local design system mirroring the landing's token vocabulary (`surface`, `surface-1`, `surface-2`, `accent-indigo`, `accent-cyan`) plus light-mode token variants, declared via a Tailwind v4 `@theme` block in `applications/console/src/index.css`.
- Add a runtime theme system: `ThemeProvider` reads `prefers-color-scheme`, lets the user override the mode, persists the override to `localStorage`, and toggles `[data-theme="dark"|"light"]` on `<html>`.
- Expose a `ThemeToggle` (sun/moon icon button) visible on every page including the unauthenticated auth pages (Login, Register, CliAuth).
- Add shared UI primitives in `applications/console/src/components/ui/`: `AppLayout`, `Card`, `Button` (with `primary` indigo→cyan gradient, `secondary`, `danger` variants), `Input`. All existing 9 pages and 8 components migrate to these primitives.
- Port landing's tasteful animations into console: `fade-up` keyframes + `animate-delay-*` utilities for mount entrances, ~200ms hover transitions on cards/buttons, pulse on status indicators.
- Apply landing-style glow blurs (`bg-accent-indigo/10 rounded-full blur-3xl` decorations) to auth pages only; internal data-dense pages stay clean.
- Adopt Inter as the console body font via Google Fonts, matching landing.
- Keep every existing route, every API call, every auth flow, every CLI handshake behavior **unchanged**.

## Capabilities

### New Capabilities

- `console-design-system`: User-facing theme behavior of the console — dark/light theme selection with OS-preference default, manual override that persists across reloads, theme control reachable from every page (authenticated or not), and a consistent visual language across all console screens that matches the public landing.

### Modified Capabilities

<!-- None. The existing console-app, console-wiki-ui, and console-token-refresh specs describe behaviors (org/project management, wiki interactions, refresh-token handling) whose requirements do not change. Only their visual presentation does, which is an implementation detail of the new console-design-system capability. -->

## Impact

- **Code**: `applications/console/src/index.css` (theme block), `applications/console/src/main.tsx` (font import, ThemeProvider mount), `applications/console/src/App.tsx` (provider wrap), all 9 page files under `src/pages/`, all 8 component files under `src/components/`, plus new files under `src/components/ui/` (`ThemeProvider.tsx`, `ThemeToggle.tsx`, `AppLayout.tsx`, `Card.tsx`, `Button.tsx`, `Input.tsx`).
- **Behavior**: New user-observable behavior — theme toggle and persistence. All other behaviors identical.
- **Dependencies**: No new npm packages required. Inter loaded via Google Fonts `<link>` tag in `index.html` (zero JS impact).
- **APIs**: None changed.
- **Landing app**: Not modified.
- **Backend**: Not modified.
