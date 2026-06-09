## ADDED Requirements

### Requirement: `npm run install:local` builds and installs the CLI globally
`applications/cli/package.json` SHALL define a `scripts.install:local` entry that runs `npm run build && npm install -g .`. The script SHALL succeed against a clean working tree and SHALL install the CLI binary so that `fabrick --help` works from any directory afterwards.

#### Scenario: Script runs build then install
- **WHEN** `npm run install:local` is invoked in `applications/cli`
- **THEN** `tsc` compiles into `dist/` and `npm install -g .` registers the `fabrick` binary

#### Scenario: Subsequent fabrick invocation succeeds
- **WHEN** `install:local` completes and the user runs `fabrick --help` from `~`
- **THEN** the help text for the v2 CLI is printed
