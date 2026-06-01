## Context

The console (`applications/console`) is a Vite + React 19 + Tailwind v4 SPA. Styling lives inline in each `.tsx` file as raw Tailwind utility strings, with no design tokens, no shared layout component, and no theme system. The active palette is generic gray/white/purple. The marketing landing (`applications/landing`) is a Vite + React 18 + Tailwind v3 site with a clearly-defined custom palette (deep `#080B10` surface, indigo→cyan accents, Inter font, fade-up keyframes, glow blurs on Hero) and per-section presentational components.

Constraints:
- Console runs Tailwind v4 (CSS-first config via `@theme`); landing runs Tailwind v3 (JS config). Tokens cannot be shared via config files; they must be re-declared in v4 syntax.
- React versions differ across apps. Console is React 19. No new dependencies should cross app boundaries.
- All current functionality must keep working: auth (login, register, refresh-token), CLI handshake, org/project CRUD, wiki search/view, synthesis trigger + polling, analytics, admin link.
- The console is server-rendered to a static SPA; theme decisions must work without SSR.

Stakeholders: end users (developers using the console after sign-up), the brand surface (landing → console hand-off).

## Goals / Non-Goals

**Goals:**

- Make the authenticated console visually cohesive with the public landing using a console-local design system.
- Support dark and light themes; default to OS preference; let users override and persist that override across reloads.
- Centralize visual primitives (`Card`, `Button`, `Input`, `AppLayout`) so future visual changes need one edit, not seventeen.
- Keep changes surgical inside React components: no behavioral changes to existing pages, no new routes, no API changes.
- Land the redesign as a single change to keep the visual transition coherent for users.

**Non-Goals:**

- No shared `packages/ui` library. Tokens and primitives live inside the console codebase only.
- No changes to landing.
- No new navigation pattern (no sidebar, no breadcrumbs, no command palette).
- No new pages, no new features.
- No changes to backend, API contracts, or auth protocol.
- No migration to a UI framework (no Radix, no shadcn, no Headless UI). Hand-rolled minimal primitives.
- No theming of Markdown content rendered by `react-markdown` beyond inheriting body text color.

## Decisions

### D1. Theme storage via `[data-theme]` attribute on `<html>` + CSS variables

The `ThemeProvider` writes `data-theme="dark"` or `data-theme="light"` on the `<html>` element. Tokens are declared as CSS custom properties scoped to those attribute selectors and consumed by Tailwind v4's `@theme` block.

**Why over alternatives:**

- *Tailwind's built-in `dark:` variant via `class="dark"`:* Works, but couples the JS API to Tailwind specifics. The `data-theme` attribute is framework-neutral, makes light-mode tokens just as first-class as dark, and reads naturally for non-Tailwind CSS (e.g., for the `react-markdown` styling).
- *Two stylesheets toggled by JS:* Adds a flash of unstyled content and complicates Vite asset handling.

The handful of token CSS variables is small enough that re-declaring values per theme is more legible than computing them.

### D2. Initial theme resolution happens in an inline `<script>` in `index.html`, before React mounts

To prevent a "flash of wrong theme" (FOUC), `applications/console/index.html` carries a small inline script that:
1. Reads `localStorage.getItem('fabrick-theme')`.
2. If absent, reads `window.matchMedia('(prefers-color-scheme: dark)').matches`.
3. Sets `document.documentElement.dataset.theme = 'dark' | 'light'` synchronously before any React code runs.

The `ThemeProvider` then hydrates from `document.documentElement.dataset.theme` and continues to manage updates.

**Why:** Any JS-only initialization runs after the first paint with default styles and causes a visible flicker on every reload. The inline script is ~10 lines and executes before paint.

### D3. `ThemeProvider` exposes `{ theme, setTheme, systemTheme }`

`setTheme('dark' | 'light' | 'auto')`. When set to `'auto'`, the provider clears `localStorage` and follows `prefers-color-scheme` reactively via a `MediaQueryList` listener. The toggle button cycles through `dark → light → auto`.

**Why three states:** Without an `auto` state, once a user clicks the toggle they're stuck on a manual theme forever and can't return to OS-tracking without clearing site data. Three states keep the contract honest.

### D4. Tokens — minimal core set, declared once in `index.css`

```css
@theme {
  --color-surface: var(--surface);
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-accent-indigo: #6366f1;
  --color-accent-indigo-dim: #4f46e5;
  --color-accent-cyan: #06b6d4;
  --color-accent-cyan-dim: #0891b2;
  --color-text-primary: var(--text-primary);
  --color-text-muted: var(--text-muted);
  --color-border: var(--border);
  --color-danger: #ef4444;
}

:root[data-theme="dark"] {
  --surface: #080B10;
  --surface-1: #0D1117;
  --surface-2: #161B22;
  --text-primary: #ffffff;
  --text-muted: #9ca3af;
  --border: rgba(255, 255, 255, 0.08);
}

:root[data-theme="light"] {
  --surface: #F8FAFC;
  --surface-1: #FFFFFF;
  --surface-2: #F1F5F9;
  --text-primary: #0F172A;
  --text-muted: #64748B;
  --border: rgba(15, 23, 42, 0.08);
}
```

Accent colors are intentionally identical in both themes; only neutrals flip. This matches the landing's accent system and avoids brand drift across modes.

**Why over a larger palette:** Less is more. Inline opacities (`bg-accent-indigo/10`, `border-white/5`) already cover the variations seen in landing without needing 12-step ramps.

### D5. `Button` variants — `primary`, `secondary`, `danger` only

`primary` uses `bg-gradient-to-r from-accent-indigo to-accent-cyan` (matches landing Hero CTA). `secondary` uses `border border-border bg-surface-1/50 hover:bg-surface-2`. `danger` uses `text-danger hover:bg-danger/10` (ghost style for low-risk destructive actions like Sign out, plus solid variant where appropriate).

Sign out is currently rendered as a bare red text link. It stays a ghost danger button. Save/Update buttons across settings pages become `primary`. Edit links stay as `secondary`.

### D6. `AppLayout` consumed only by authenticated pages

`AppLayout` wraps the page chrome: header with brand, optional admin link, user email, theme toggle, sign out — plus a `<main>` slot. Used by OrgList, OrgDetail, OrgSettings, ProjectDetail, ProjectSettings, ProjectAnalytics, CliAuth.

Login and Register do not use `AppLayout` (they have their own centered Hero-style composition with the glow blurs).

### D7. Animations — port landing's `fadeUp` keyframe + delay utilities; nothing else

```css
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

Used on page-title rows and the first content row of each page. Hover transitions are plain `transition-colors duration-200`. No spring physics, no Framer Motion, no layout transitions, no scroll-driven effects.

Status pulses for the synthesis running indicator reuse the existing Tailwind `animate-pulse`.

### D8. Glow blurs — auth pages only

Login, Register, CliAuth get the `bg-accent-indigo/10 rounded-full blur-3xl` decorations behind their cards (one large indigo blob, one smaller cyan blob, offset to match the Hero composition). All authenticated app pages omit them — those screens are data-dense and decoration competes with content.

### D9. Inter font loaded via Google Fonts `<link>`

Added to `applications/console/index.html` `<head>`. No `npm` package, no font self-hosting. The `font-sans` family in `@theme` is set to `Inter, system-ui, sans-serif`.

**Why over self-hosting:** Self-hosting needs build wiring, font subsetting, and license bookkeeping. Landing uses Google Fonts the same way; consistency wins.

### D10. Migration order during implementation

Tokens + provider + primitives first → then auth pages (smaller, set the visual tone) → then list pages (OrgList) → then detail pages → then settings/analytics → then shared components. Each page migration is a self-contained commit.

## Risks / Trade-offs

- **[Risk] FOUC on first load if the inline init script regresses.** Mitigation: Add an e2e check that asserts `document.documentElement.dataset.theme` is set within the first paint (Playwright `evaluate` immediately after `goto`).
- **[Risk] `react-markdown` rendered wiki content uses default browser styles and may look ugly on dark backgrounds.** Mitigation: Add scoped CSS in `index.css` for `.markdown-body` selectors targeting `h*`, `p`, `code`, `pre`, `a`, `ul/ol`, mapped to tokens.
- **[Risk] Light-mode contrast for the indigo→cyan gradient buttons drops legibility of small button text.** Mitigation: Gradient stays the same; text stays white in both themes. Visually verify after migration.
- **[Risk] Storybook-less primitives drift in usage.** Mitigation: Centralize all variants inside the primitive files; encourage pages to pass `variant`, not raw className overrides. Allow a `className` escape hatch only for layout (margins, widths).
- **[Trade-off] No shared package** keeps scope small now but means a future landing/console alignment effort will need to re-extract tokens. Accepted.
- **[Trade-off] Three-state toggle (dark/light/auto)** is more honest but slightly more clicks than a binary toggle. Accepted.

## Migration Plan

The change ships as a single PR. Roll-out is a normal deploy of the `applications/console` static bundle.

Per-step sequence inside the PR:

1. Add Inter font link + theme init inline script to `index.html`.
2. Update `index.css` with `@theme` block + light/dark token blocks + `fadeUp` keyframes + Markdown body scoped styles.
3. Build `ThemeProvider`, `ThemeToggle`.
4. Build `AppLayout`, `Card`, `Button`, `Input` primitives.
5. Wrap `App.tsx` with `ThemeProvider`.
6. Migrate auth pages (Login, Register, CliAuth) — establishes glow blur pattern.
7. Migrate `OrgList` → `OrgDetail` → `OrgSettings`.
8. Migrate `ProjectDetail` → `ProjectSettings` → `ProjectAnalytics`.
9. Migrate the 8 reusable components (`ApiKey*`, `Wiki*`, `ProjectKeyResolutionChain`).
10. Visual QA in both themes + theme persistence check + verify all existing functionality.

No data migration. No backend rollout coordination. Rollback is reverting the deploy.

## Open Questions

- Should the theme toggle cycle through three states (dark → light → auto) with an icon hint for the current mode, or use a small dropdown menu? **Tentative answer:** three-state cycle, icon shows current resolved theme, `title` attribute shows the next state.
- Should we add a thin top progress bar (à la NProgress) for route transitions, or leave navigation snappy and silent? **Tentative answer:** leave silent; tasks here don't take long.
- Does the wiki page rendered Markdown body need its own typography step (headings hierarchy, code blocks), or do we ship a minimal token-based pass and iterate? **Tentative answer:** minimal pass now (`text-primary`, `text-muted`, mono code), revisit after first user signal.
