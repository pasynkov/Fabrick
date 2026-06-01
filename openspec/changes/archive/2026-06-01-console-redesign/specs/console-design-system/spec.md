## ADDED Requirements

### Requirement: Console resolves an initial theme without a flash of mismatched styles

The console SHALL determine and apply the active theme before the first paint. The resolution order MUST be: (1) a persisted user override stored in browser local storage under key `fabrick-theme` with value `"dark"` or `"light"`; (2) if absent, the OS preference reported by `(prefers-color-scheme: dark)`; (3) if the OS preference cannot be read, the dark theme.

The active theme MUST be reflected by a `data-theme` attribute on the `<html>` element with value `"dark"` or `"light"`, and all token-driven styles MUST derive from CSS custom properties scoped to that attribute.

#### Scenario: First visit on a system set to dark mode
- **WHEN** a user with no prior console activity loads any console URL on a device whose OS reports `prefers-color-scheme: dark`
- **THEN** the first painted frame uses dark-theme tokens
- **AND** `document.documentElement.getAttribute("data-theme")` equals `"dark"`
- **AND** `localStorage.getItem("fabrick-theme")` is `null`

#### Scenario: First visit on a system set to light mode
- **WHEN** a user with no prior console activity loads any console URL on a device whose OS reports `prefers-color-scheme: light`
- **THEN** the first painted frame uses light-theme tokens
- **AND** `document.documentElement.getAttribute("data-theme")` equals `"light"`

#### Scenario: Returning visit honors prior override
- **WHEN** a user who previously selected `"light"` reloads the console on a device whose OS reports `prefers-color-scheme: dark`
- **THEN** the first painted frame uses light-theme tokens
- **AND** `document.documentElement.getAttribute("data-theme")` equals `"light"`

### Requirement: Console exposes a theme toggle on every page

The console SHALL render a theme control on every route, including the unauthenticated routes `/login`, `/register`, and `/cli-auth`. The control MUST be reachable without scrolling on a viewport of at least 360px width.

The control MUST cycle through three states in order: `dark`, `light`, `auto`. The control MUST visually indicate the currently active state (resolved theme) and MUST announce (via accessible label or `title`) the next state it will activate on click.

#### Scenario: Toggle visible on a public auth route
- **WHEN** the user loads `/login` without being authenticated
- **THEN** the theme toggle control is present in the rendered DOM
- **AND** the control is focusable via keyboard

#### Scenario: Toggle visible on an authenticated route
- **WHEN** the authenticated user loads `/orgs/{slug}/projects/{slug}`
- **THEN** the theme toggle control is present in the rendered DOM

#### Scenario: Cycle from dark to light to auto and back to dark
- **GIVEN** the user is in `dark` mode (manually selected)
- **WHEN** the user activates the toggle
- **THEN** the resolved theme becomes `light`
- **AND** `localStorage.getItem("fabrick-theme")` equals `"light"`
- **WHEN** the user activates the toggle a second time
- **THEN** the override is cleared
- **AND** `localStorage.getItem("fabrick-theme")` is `null`
- **AND** the resolved theme follows the current OS preference
- **WHEN** the user activates the toggle a third time
- **THEN** the resolved theme becomes the opposite of the current OS preference (manual override)

### Requirement: Theme override persists across reloads and tabs

When the user manually selects a theme (`dark` or `light`), the choice SHALL persist to browser local storage and be honored on subsequent loads of the same origin in the same browser profile.

When the user clears their override (selects `auto`), the persisted entry MUST be removed.

#### Scenario: Persistence across reload
- **GIVEN** the user has just selected the light theme on the console
- **WHEN** the user reloads the page
- **THEN** the console renders in the light theme on first paint

#### Scenario: Auto state removes persisted override
- **GIVEN** the user previously selected the light theme
- **WHEN** the user toggles to `auto`
- **THEN** `localStorage.getItem("fabrick-theme")` is `null`
- **AND** subsequent reloads follow OS preference

### Requirement: Auto mode tracks OS preference changes live

While the user has not selected a manual override, the console SHALL update its applied theme in response to changes to the OS preference without requiring a reload.

#### Scenario: OS preference flips while console is open
- **GIVEN** the user has the console open in `auto` mode and the OS is set to dark
- **WHEN** the user changes their OS to light mode while the console tab remains open
- **THEN** the console transitions to the light theme within the same tab session
- **AND** `document.documentElement.getAttribute("data-theme")` equals `"light"`

### Requirement: Existing console behavior is preserved

The redesign MUST NOT change any route path, API call, request body, response handling, redirect target, auth flow step, CLI authorization handshake step, polling cadence, error message text returned by the backend, or any user-observable behavior outside the visual surface and the new theme control.

#### Scenario: Login flow unchanged
- **WHEN** a user submits valid credentials on `/login`
- **THEN** the console issues the same `POST` to the login endpoint as before the redesign
- **AND** stores the access and refresh tokens per the existing persistence rules
- **AND** navigates to the `return_to` or `next` query parameter target, defaulting to `/`

#### Scenario: Synthesis trigger and polling unchanged
- **WHEN** a user clicks "Run synthesis" on a project detail page
- **THEN** the console triggers the synthesis endpoint exactly once and begins polling status every 3 seconds
- **AND** stops polling when the status leaves `running`
- **AND** refreshes the wiki page list when the status reaches `done`

#### Scenario: All current routes still resolve
- **WHEN** any of the routes `/login`, `/register`, `/cli-auth`, `/`, `/orgs/:orgSlug`, `/orgs/:orgSlug/edit`, `/orgs/:orgSlug/settings`, `/orgs/:orgSlug/projects/:projectSlug`, `/orgs/:orgSlug/projects/:projectSlug/edit`, `/orgs/:orgSlug/projects/:projectSlug/settings`, `/orgs/:orgSlug/projects/:projectSlug/analytics` is requested
- **THEN** the corresponding page renders with the same access guard and same redirect targets as before the redesign

### Requirement: Visual cohesion with the landing surface

The console SHALL adopt the same accent palette as the landing (`#6366f1` indigo and `#06b6d4` cyan) and the same body font family (Inter, falling back to `system-ui`). Primary calls-to-action SHALL render with an indigo-to-cyan linear gradient matching the landing Hero sign-up button.

#### Scenario: Primary action uses the gradient
- **WHEN** the user observes a primary action button on any console page
- **THEN** the button's background is a left-to-right linear gradient from `#6366f1` to `#06b6d4`

#### Scenario: Body text uses Inter
- **WHEN** the console renders any text node in body copy
- **THEN** the computed `font-family` of that node resolves to `Inter` (when available) before any fallback

### Requirement: Decorative glow appears only on auth surfaces

Auth pages (`/login`, `/register`, `/cli-auth`) SHALL render decorative blurred indigo and cyan blobs behind their primary content, matching the landing Hero composition. Authenticated app pages MUST NOT render decorative blobs.

#### Scenario: Glow visible on login
- **WHEN** the user loads `/login`
- **THEN** the rendered DOM contains at least one element with a blur filter applied to a translucent indigo background

#### Scenario: No glow on authenticated dashboard
- **WHEN** the authenticated user loads `/`
- **THEN** the rendered DOM contains no element with a blur filter applied to a translucent indigo background
