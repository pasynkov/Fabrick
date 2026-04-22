## Context

Landing is a Vite + React + Tailwind app deployed to Azure Static Web Apps via `swa` CLI. Components: Hero, Problem, Solution, Privacy, Footer. All static — no routing, no state.

## Decisions

### Hero CTA

Primary: `<a href="https://console.fabrick.me/register">Sign up free</a>` — styled as button (same as current primary button).
Secondary: `<a href="https://github.com/pasynkov/Fabrick">View on GitHub</a>` — replaces "See how it works".

Badge: remove "waitlist" language → `Open beta` with pulse dot.

### GitHub link in Footer

Add GitHub icon link next to logo. Use inline SVG (no icon library dependency).

### Roadmap section

New component `Roadmap.tsx`. Placed between Solution and Privacy.

Three cards with abstract direction (not specific features):

1. **Always current** — context that updates as code evolves, not documentation that drifts
2. **Team-aware** — shared understanding across teams, repos, and disciplines  
3. **Agent-native** — AI agents as first-class participants, not just tools

Opening copy: "Today's teams coordinate through documents, tickets, and meetings. Today's AI agents coordinate through context windows and prompts. Neither knows what the other knows. Fabrick is building the layer where both operate together."

### README changes

- Add before "Install the CLI": `### Create an account\nGo to [console.fabrick.me/register](https://console.fabrick.me/register) and sign up.`
- Remove entire `## 🔌 Works with your tools` section
- Rewrite `## 🌱 Future` → remove "Fabrick Cloud (hosted platform)" (it exists), keep direction abstract
