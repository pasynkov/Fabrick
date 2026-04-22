## Why

The landing page still shows "Private beta · Join the waitlist" and has no working CTAs — but Fabrick is live with open registration. README references features that don't exist (Jira, Confluence integrations) and missing the sign-up step. Both need to reflect current reality and communicate where the product is going.

## What Changes

- Replace waitlist badge and CTA with "Sign up free" → console.fabrick.me/register
- Add GitHub link to Hero secondary CTA and Footer
- Add "Where we're going" vision section (teams + agents as unified system)
- README: add sign-up as Step 0 in Getting Started
- README: remove "Works with your tools" section (Jira/Confluence — not implemented)
- README: update Future section (Fabrick Cloud already exists)

## Capabilities

### New Capabilities

_(no new product capabilities — marketing and documentation update only)_

### Modified Capabilities

_(no requirement changes to existing capabilities)_

## Impact

- `applications/landing/src/components/Hero.tsx` — CTA links, badge text
- `applications/landing/src/components/Footer.tsx` — GitHub link
- `applications/landing/src/components/Roadmap.tsx` — new component
- `applications/landing/src/App.tsx` — add Roadmap between Solution and Privacy
- `README.md` — Getting Started step 0, remove Jira/Confluence section, update Future
