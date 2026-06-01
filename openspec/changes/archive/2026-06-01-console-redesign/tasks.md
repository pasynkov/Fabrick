## 1. Foundation: tokens, fonts, FOUC-free init

- [x] 1.1 Add Inter font `<link>` tags (preconnect + stylesheet) to `applications/console/index.html` `<head>`.
- [x] 1.2 Add an inline `<script>` to `applications/console/index.html` that reads `localStorage.getItem('fabrick-theme')`, falls back to `matchMedia('(prefers-color-scheme: dark)')`, and sets `document.documentElement.dataset.theme` before React mounts.
- [x] 1.3 Rewrite `applications/console/src/index.css` with a Tailwind v4 `@theme` block exposing `surface`, `surface-1`, `surface-2`, `accent-indigo`, `accent-indigo-dim`, `accent-cyan`, `accent-cyan-dim`, `text-primary`, `text-muted`, `border`, `danger`, and `font-sans: Inter, system-ui, sans-serif`.
- [x] 1.4 In the same `index.css`, declare `:root[data-theme="dark"]` and `:root[data-theme="light"]` blocks setting the neutral CSS custom properties referenced by `@theme`.
- [x] 1.5 In `index.css`, declare the `fadeUp` keyframes and `.animate-fade-up`, `.animate-delay-100`, `.animate-delay-200`, `.animate-delay-300` utility classes ported from landing.
- [x] 1.6 In `index.css`, add scoped Markdown styles for `.markdown-body` selectors (`h1`–`h4`, `p`, `code`, `pre`, `a`, `ul`, `ol`, `blockquote`) mapped to the new tokens.

## 2. Theme runtime

- [x] 2.1 Create `applications/console/src/components/ui/ThemeProvider.tsx` exposing a context with `{ theme, resolvedTheme, setTheme }` where `theme` is `'dark' | 'light' | 'auto'` and `resolvedTheme` is `'dark' | 'light'`.
- [x] 2.2 In `ThemeProvider`, hydrate the initial state from `document.documentElement.dataset.theme` and `localStorage`, subscribe to `matchMedia('(prefers-color-scheme: dark)')` changes while in `auto`, and persist `dark` / `light` selections to `localStorage` (clearing the key when switching to `auto`).
- [x] 2.3 Create `applications/console/src/components/ui/ThemeToggle.tsx`: an icon button that displays a sun, moon, or circle for `light` / `dark` / `auto`, advances `theme` in the cycle `dark → light → auto → dark` on click, exposes an accessible `aria-label` describing the next state, and is keyboard-focusable.
- [x] 2.4 Wrap `applications/console/src/App.tsx`'s tree in `<ThemeProvider>` before `<AuthProvider>` so all routes (including auth) see the context.

## 3. UI primitives

- [x] 3.1 Create `applications/console/src/components/ui/Button.tsx` with `variant: 'primary' | 'secondary' | 'danger'`, optional `size: 'sm' | 'md' | 'lg'`, forwards `type`, `disabled`, `onClick`, and other native button props, and allows a `className` escape hatch for layout only.
- [x] 3.2 Create `applications/console/src/components/ui/Card.tsx` rendering a `surface-1` background with `border-border` and a `hover:border-white/10` accent; accepts `as`, `className`, `children`, and an optional `interactive` flag that adds the hover transition.
- [x] 3.3 Create `applications/console/src/components/ui/Input.tsx` wrapping a native `<input>` with token-driven border/background/focus ring (`focus:ring-accent-indigo/50`), supports `type`, `value`, `onChange`, `placeholder`, `required`, `disabled`, and forwards `ref`.
- [x] 3.4 Create `applications/console/src/components/ui/AppLayout.tsx` rendering a top header containing the Fabrick brand link, an optional admin link (when `user.isPlatformAdmin`), the user email, the `<ThemeToggle />`, and a Sign out `danger` button; renders `children` inside `<main class="max-w-* mx-auto px-* py-*">` with sensible container sizing.

## 4. Auth pages (set the visual tone)

- [x] 4.1 Migrate `applications/console/src/pages/Login.tsx`: centered `Card` over a glow-blur background (one indigo blob, one cyan blob); replace the form inputs with `<Input />`, the submit with primary `<Button />`; place `<ThemeToggle />` in the top-right corner; preserve `persistent` checkbox behavior and submit handler verbatim.
- [x] 4.2 Migrate `applications/console/src/pages/Register.tsx` to the same Hero-style composition; reuse the glow background, primary `<Button />`, and preserve registration submit logic verbatim.
- [x] 4.3 Migrate `applications/console/src/pages/CliAuth.tsx`: dark/light-themed centered card, primary `<Button />` for "Authorize" and secondary `<Button />` for "Cancel"; preserve the CLI handshake behavior unchanged.
- [x] 4.4 Add `animate-fade-up` to each auth card's header and primary CTA.

## 5. Authenticated pages

- [x] 5.1 Migrate `applications/console/src/pages/OrgList.tsx`: wrap in `<AppLayout>`; replace the org list items with `<Card interactive>`; replace the Edit link with a secondary `<Button />`; preserve org-list fetch behavior unchanged.
- [x] 5.2 Migrate `applications/console/src/pages/OrgDetail.tsx`: wrap in `<AppLayout>`; replace inline cards with `<Card>`; replace action buttons with `<Button />`; preserve all org-detail data fetches and project list logic unchanged.
- [x] 5.3 Migrate `applications/console/src/pages/OrgSettings.tsx`: wrap in `<AppLayout>`; replace form controls with `<Input />` and primary `<Button />`; preserve update / delete logic verbatim.
- [x] 5.4 Migrate `applications/console/src/pages/ProjectDetail.tsx`: wrap in `<AppLayout>`; replace inline cards with `<Card>`; replace the "Run synthesis" trigger with a primary `<Button />`; preserve synthesis polling cadence and wiki refresh logic unchanged.
- [x] 5.5 Migrate `applications/console/src/pages/ProjectSettings.tsx`: wrap in `<AppLayout>`; replace form controls with `<Input />` and `<Button />`; preserve update / delete logic verbatim.
- [x] 5.6 Migrate `applications/console/src/pages/ProjectAnalytics.tsx`: wrap in `<AppLayout>`; replace inline cards with `<Card>`; restyle charts/tables with token classes; preserve analytics data fetches unchanged.

## 6. Reusable components

- [x] 6.1 Restyle `applications/console/src/components/ApiKeySection.tsx` using `<Card>` + token classes; preserve API key state logic unchanged.
- [x] 6.2 Restyle `applications/console/src/components/ApiKeyForm.tsx` using `<Input />` + `<Button />`; preserve submit handler and validation logic unchanged.
- [x] 6.3 Restyle `applications/console/src/components/ApiKeyStatusDisplay.tsx` with token classes for the status badge.
- [x] 6.4 Restyle `applications/console/src/components/ApiKeyAuditLogs.tsx` with token classes for the table and pagination.
- [x] 6.5 Restyle `applications/console/src/components/ProjectKeyResolutionChain.tsx` with token classes; preserve resolution chain rendering logic unchanged.
- [x] 6.6 Restyle `applications/console/src/components/WikiSearch.tsx` using `<Input />` and token-driven result list; preserve search debounce and API call logic unchanged.
- [x] 6.7 Restyle `applications/console/src/components/WikiPagesTable.tsx` with token classes for the table rows and column headers; preserve sort / filter logic unchanged.
- [x] 6.8 Restyle `applications/console/src/components/WikiPageView.tsx`: apply the `markdown-body` class to the rendered Markdown container; preserve `react-markdown` configuration verbatim.

## 7. Verification

- [ ] 7.1 Manually verify in a browser: load each route in dark mode, light mode, and `auto` mode; toggle theme on every page; reload and confirm the persisted choice is honored; flip OS theme while console is open in `auto` and confirm live update.
- [ ] 7.2 Manually verify on each page that all pre-existing user actions (login, register, CLI authorize, create/rename/delete org, create/rename/delete project, run synthesis, search wiki, view wiki page, manage API keys, view analytics) behave identically to before the redesign.
- [x] 7.3 Run `npm run build` inside `applications/console` and resolve any TypeScript or build errors.
- [x] 7.4 Run `npm run lint` inside `applications/console` and resolve any lint errors introduced by the redesign.
- [ ] 7.5 Confirm no FOUC: hard-reload `/login` and `/` in both themes and verify that the first paint matches the resolved theme (no white-to-dark flash).
