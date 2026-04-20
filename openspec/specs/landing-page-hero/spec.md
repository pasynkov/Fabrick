## MODIFIED Requirements

### Requirement: Hero section displays brand positioning headline
The Hero section SHALL display "The choreography layer for modern work" as the primary H1 headline, with a visual gradient accent applied to the coined term "choreography layer".

#### Scenario: Headline is visible on page load
- **WHEN** the landing page loads
- **THEN** the H1 reads "The choreography layer for modern work" with "choreography layer" rendered in the indigo-to-cyan gradient

#### Scenario: Headline is readable on mobile
- **WHEN** the page is viewed on a mobile viewport (< 768px)
- **THEN** the headline text is fully visible without overflow or truncation

#### Scenario: Subheadline and CTA remain unchanged
- **WHEN** the hero section is rendered
- **THEN** the subheadline ("Fabrick extracts what matters..."), the badge, and the CTA buttons are unchanged from the previous version
