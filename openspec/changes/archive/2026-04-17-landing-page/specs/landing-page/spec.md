## ADDED Requirements

### Requirement: App scaffolded and runnable
The application SHALL be a standalone Vite + React + Tailwind project under `applications/landing/` that runs locally with `npm run dev`.

#### Scenario: Local development server starts
- **WHEN** developer runs `npm run dev` from `applications/landing/`
- **THEN** Vite dev server starts and the landing page is accessible in the browser

#### Scenario: Production build succeeds
- **WHEN** developer runs `npm run build`
- **THEN** build completes without errors and outputs static files to `dist/`

### Requirement: Hero section
The page SHALL have a Hero section that communicates Fabrick's core value proposition.

#### Scenario: Hero content is present
- **WHEN** the page loads
- **THEN** the hero section displays a headline, subheadline, and a CTA button

#### Scenario: CTA button is visible
- **WHEN** user views the hero section
- **THEN** a "Get Early Access" button is visible (no action required for now)

### Requirement: Problem section
The page SHALL have a Problem section that illustrates the fragmentation problem Fabrick solves.

#### Scenario: Problem content is present
- **WHEN** user scrolls to the problem section
- **THEN** it shows the pain points: fragmented knowledge, incomplete communication, stale docs, disconnected systems

### Requirement: Solution section
The page SHALL have a Solution section that explains how Fabrick works.

#### Scenario: Solution content is present
- **WHEN** user scrolls to the solution section
- **THEN** it shows how agents, tools, and teams connect through a shared context layer

### Requirement: Privacy section
The page SHALL have a Privacy section that communicates Fabrick's privacy-first model.

#### Scenario: Privacy content is present
- **WHEN** user scrolls to the privacy section
- **THEN** it clearly states that Fabrick does not store source code, secrets, or proprietary logic — only metadata, schemas, and relationships

### Requirement: Footer
The page SHALL have a Footer with the Fabrick name and domain.

#### Scenario: Footer is present
- **WHEN** user scrolls to the bottom of the page
- **THEN** footer displays "fabrick.me" and a copyright or tagline

### Requirement: Dark theme visual design
The page SHALL use a dark theme with an AI-first aesthetic.

#### Scenario: Dark background applied
- **WHEN** the page loads
- **THEN** background is near-black and all text is legible with appropriate contrast

#### Scenario: Accent color applied
- **WHEN** the page is viewed
- **THEN** accent elements (buttons, highlights, icons) use indigo or cyan tones consistent with an AI-first visual style
