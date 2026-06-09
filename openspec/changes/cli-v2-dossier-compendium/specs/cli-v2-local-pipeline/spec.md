## ADDED Requirements

### Requirement: Tree-sitter extractors live in the CLI
The CLI SHALL include TypeScript and YAML extractors built on `tree-sitter`, `tree-sitter-typescript`, and `tree-sitter-yaml`, producing the same symbol shape used by `applications/incremental-lab` (`class`, `method`, `field`, `decorator`, `signature`, `imports`, `location`). The extractors SHALL be invoked by snapshot, scope-detection, and diff routines without spawning an external process.

#### Scenario: TypeScript extractor lifts a NestJS controller
- **WHEN** the extractor runs over a `.ts` file containing a class decorated with `@Controller`
- **THEN** the resulting symbols include a `class` with decorator entries naming `Controller`

#### Scenario: YAML extractor lifts kustomize fields
- **WHEN** the extractor runs over a `kustomization.yaml`
- **THEN** the resulting symbols include `field` entries for `resources` and `images`

### Requirement: Per-app scope detection covers monorepos
The CLI SHALL detect scopes from `nest-cli.json` `projects[]` (code monorepos) and from `kustomization.yaml` trees (GitOps repos), producing one scope per app or per kustomize root. Single-app repos SHALL produce one scope rooted at the repo.

#### Scenario: NestJS monorepo detection
- **WHEN** the repo root contains `nest-cli.json` with three projects
- **THEN** scope detection returns three scope entries with `root` set to each project's source root

#### Scenario: Kustomize repo detection
- **WHEN** the repo root contains a `kustomization.yaml` tree with five overlays
- **THEN** scope detection returns one entry per overlay root

#### Scenario: Single-app fallback
- **WHEN** the repo has neither `nest-cli.json` nor a kustomize root
- **THEN** scope detection returns one scope rooted at the repo

### Requirement: Markdown fingerprint extractor filters paraphrase changes
The CLI SHALL include a markdown extractor that lifts wiki/dossier pages into structural symbols (`section`, `bullet`, `table_row`) with both `bodyHash` and `fingerprintHash` (label + sorted link paths). Synthesis-style filtering SHALL use `fingerprintHash` to skip wiki changes that only paraphrase text.

#### Scenario: Identical fingerprint hashes skip the change
- **WHEN** two versions of a page differ only in prose wording but reference the same links
- **THEN** the extractor reports the same `fingerprintHash` and the filter marks the change as paraphrase-only

#### Scenario: New link triggers a change
- **WHEN** a page adds a markdown link to a new source file
- **THEN** the extractor reports a different `fingerprintHash` and the change is not filtered out

### Requirement: `dynamicThreshold` follows the ADR D14 curve
The CLI SHALL include a `dynamicThreshold(fullscanTokens: number): number` function that returns a value clamped to `[0.30, 0.90]` using a log curve centred at `refTok = 8000`. It SHALL NOT rely on USD pricing.

#### Scenario: Curve hits the documented anchor points
- **WHEN** the function is called with 1000, 8000, 50000, and 500000
- **THEN** the returned values round to 0.30, 0.50, 0.70, and 0.90 respectively

#### Scenario: Clamp at the lower bound
- **WHEN** the function is called with 1 token
- **THEN** the returned value is 0.30

#### Scenario: Clamp at the upper bound
- **WHEN** the function is called with 10_000_000 tokens
- **THEN** the returned value is 0.90

### Requirement: Claude Code subprocess wrapper handles every LLM call
The CLI SHALL route every LLM call through a single Claude Code subprocess wrapper that invokes `claude -p` with `--system-prompt`, `--tools ""`, `--disable-slash-commands`, and `--settings {enabledPlugins:{caveman:false}}`. The wrapper SHALL accept a model identifier (`claude-sonnet-4-6` or `claude-haiku-4-5`), system prompt, user input, and tool list. It SHALL surface non-zero exit codes as typed errors without retrying.

#### Scenario: Compute pass uses sonnet
- **WHEN** `fabrick sync` invokes the wrapper for a patch compute pass
- **THEN** the model identifier passed to `claude -p` is `claude-sonnet-4-6`

#### Scenario: Apply pass uses haiku
- **WHEN** `fabrick sync` invokes the wrapper for a patch apply pass
- **THEN** the model identifier passed to `claude -p` is `claude-haiku-4-5`

#### Scenario: Wrapper exits with subprocess error
- **WHEN** `claude -p` exits non-zero
- **THEN** the wrapper throws a typed error containing the exit code and captured stderr

### Requirement: One-sentence description per scope is appended to the patch log
For every produced scope in a sync or regen run, the CLI SHALL call the wrapper once with `claude-haiku-4-5` and the rendered markdown diff, capture a one-sentence description (≤ 30 words), and include that description in both the `PushDossierUpdateDto` event `meta` and the `.fabrick/patches.log.jsonl` entry.

#### Scenario: Description names concrete identifiers
- **WHEN** a sync run produces a change to NATS subjects and Kafka topics
- **THEN** the recorded description references those identifiers literally

#### Scenario: Description is bounded
- **WHEN** the haiku call returns a description longer than 30 words
- **THEN** the wrapper truncates or rejects the output before persistence

### Requirement: Page bodies are stamped with frontmatter before write
The CLI SHALL stamp every dossier page with YAML frontmatter (`name`, `description`, `type: dossier`, `repo`, `scope`, `slug`, `sha`, `updatedAt`) before writing to `.fabrick/dossier/<scope>/<slug>.md`. The LLM SHALL NOT produce frontmatter.

#### Scenario: Frontmatter present after sync
- **WHEN** a sync run writes a new page body
- **THEN** the file starts with a YAML block containing the documented fields

### Requirement: Deterministic index pages are generated
For every scope with at least one slug body, the CLI SHALL emit `index.md` from the four slugs' frontmatter (`description`) without invoking the LLM.

#### Scenario: Index lists all slugs
- **WHEN** a scope has four slug pages on disk
- **THEN** `.fabrick/dossier/<scope>/index.md` contains one entry per slug with its description
