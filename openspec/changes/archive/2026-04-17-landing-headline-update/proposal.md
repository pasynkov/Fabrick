## Why

The landing page uses a generic headline ("One layer of context. Every tool aligned.") but the brand's real positioning line — "The choreography layer for modern work" — is stronger, more distinctive, and better captures what Fabrick does. This needs to be the hero headline.

## What Changes

- Replace `Hero.tsx` headline with "The choreography layer for modern work"
- Restructure the hero copy hierarchy: brand slogan as H1, current tagline demoted to subheadline or removed
- Ensure the gradient treatment and visual weight still work with the new text

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `landing-page-hero`: Hero headline copy changes — the displayed H1 text and its visual treatment

## Impact

- One file: `applications/landing/src/components/Hero.tsx`
- No dependency changes, no build changes
- Pure copy + layout adjustment
