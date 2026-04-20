## Context

`Hero.tsx` currently uses "One layer of context. / Every tool aligned." as the H1. The brand tagline "The choreography layer for modern work" is a stronger positioning statement — it's more distinctive and better describes Fabrick's role. This is a copy-only change to a single component.

## Goals / Non-Goals

**Goals:**
- Make "The choreography layer for modern work" the primary H1
- Preserve the gradient accent treatment on the key phrase
- Keep the subheadline, badge, and CTA unchanged

**Non-Goals:**
- Changing any other sections
- Rethinking overall visual design
- Adding new animations or layout changes

## Decisions

### New H1 structure
Split across two lines for visual impact:
```
The choreography layer
for modern work
```
Apply the indigo→cyan gradient to "choreography layer" — it's the coined term that needs to pop.

### Subheadline
Keep existing subheadline ("Fabrick extracts what matters...") unchanged — it explains the mechanism, which now follows cleanly from the positioning line.

## Risks / Trade-offs

- "Choreography layer" is a longer string than the previous headline → check text doesn't overflow on small viewports at `text-7xl`. Use `md:text-7xl` breakpoint (already in place).
- No other risks — pure text change.
