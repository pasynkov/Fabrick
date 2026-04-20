## Context

No frontend application exists yet. This is the first entry under `applications/`. The landing page is a standalone static site — no backend, no auth, no API calls. Scope is local development only; deployment is a separate future change.

## Goals / Non-Goals

**Goals:**
- Scaffold `applications/landing/` as an autonomous Vite + React + Tailwind app
- Implement landing page with 5 sections: Hero, Problem, Solution, Privacy, Footer
- Dark theme, modern AI-first visual style
- `npm run dev` works out of the box

**Non-Goals:**
- Deployment, CI/CD, infrastructure (separate change)
- Backend, forms, waitlist API integration
- Routing / multiple pages
- i18n

## Decisions

### Vite + React + Tailwind
Standard modern stack for static sites. Vite gives fast HMR, Tailwind keeps styles collocated and consistent. No alternatives considered — already decided.

### Standalone app (not monorepo)
Each app under `applications/` is fully autonomous. No shared `packages/` yet. If a UI component library emerges later, it can be extracted then.

### Component structure
Flat — one component per section, composed in `App.tsx`. No routing, no state management needed.

```
src/
├── components/
│   ├── Hero.tsx
│   ├── Problem.tsx
│   ├── Solution.tsx
│   ├── Privacy.tsx
│   └── Footer.tsx
├── App.tsx
└── main.tsx
```

### Visual design direction
- Background: near-black (`#080B10` range)
- Accent: electric indigo / cyan (`#6366f1` / `#06b6d4`)
- Typography: Inter or Geist (system-friendly)
- Motion: subtle fade-ins via Tailwind `animate-` or CSS transitions only — no animation library
- Inspiration: Linear, Vercel, Clerk — minimal, sharp, technical

## Risks / Trade-offs

- Design taste is subjective → can iterate once scaffold is in place
- No animation library keeps bundle small but limits expressiveness → acceptable for v1

## Open Questions

- Waitlist / CTA button: link to email, form, or just visual for now? → treat as visual for now (no action on click)
