/**
 * Minimal per-app wiki taxonomy. Each app scope produces exactly 4 pages.
 *
 * service.md         purpose, framework, deployment kind, replication
 * contracts.md       external API (HTTP routes, NATS subjects, queues)
 * config.md          environment variables and runtime configuration
 * integrations.md    external systems the app talks to (DB, GCS, NATS, …)
 *
 * Page slugs are fixed. The single LLM call per scope emits all four
 * pages in structured output.
 */

export const APP_PAGES = [
  {
    slug: 'service.md',
    title: 'Service Overview',
    focus: 'WHAT this app is: its purpose in 1–2 sentences, framework (NestJS / Express / etc.), deployment kind (worker / HTTP API / event-driven), replication / scaling traits (single instance / horizontal / leader-elected), and lifecycle (startup hooks, shutdown).',
  },
  {
    slug: 'contracts.md',
    title: 'External Contracts',
    focus: 'EVERY incoming / outgoing interface. List explicitly:\n- HTTP routes (method + path + brief purpose)\n- NATS subjects (subject + role: consumer / publisher / request-reply)\n- Kafka topics consumed / produced\n- gRPC services exposed\n- Outgoing calls to other services (request/reply target subjects, REST clients)\nUse exact identifiers from the source.',
  },
  {
    slug: 'config.md',
    title: 'Configuration',
    focus: 'Runtime configuration. Group by concern (Database / Messaging / Auth / Observability / Storage / Domain). Per item:\n- Environment variable name (exact, e.g. ASSETS_REGISTRY_POSTGRES_DATABASE)\n- Default value or fallback if present\n- One-line description of what it controls\nInclude ConfigMaps / Secrets referenced via envFrom if visible.',
  },
  {
    slug: 'integrations.md',
    title: 'External Integrations',
    focus: 'Every external system this app touches. One bullet per integration:\n- system kind (PostgreSQL / NATS cluster / GCS bucket / Kafka cluster / Redis / external HTTP API)\n- exact identifiers (database name, bucket name, broker host)\n- direction (reads / writes / both)\n- purpose (what data flows through)\nSkip internal shared libs (those are plumbing, not integrations).',
  },
];

export const APP_PAGE_SLUGS = APP_PAGES.map((p) => p.slug);

/**
 * Detect changes against a snapshot diff to figure out whether ANY of the
 * 4 pages should be regenerated.
 *
 * In the minimal taxonomy we regenerate ALL 4 pages whenever any source
 * file in the scope changes — simpler and only one LLM call per scope.
 *
 * Returns affected slugs (all 4 if any change, none if no change).
 */
export function affectedAppPages(diff) {
  const hasChange =
    (diff.symbols.added?.length ?? 0) > 0 ||
    (diff.symbols.sigChanged?.length ?? 0) > 0 ||
    (diff.symbols.bodyChanged?.length ?? 0) > 0 ||
    (diff.symbols.deleted?.length ?? 0) > 0 ||
    (diff.files?.added?.length ?? 0) > 0 ||
    (diff.files?.deleted?.length ?? 0) > 0 ||
    (diff.files?.changed?.length ?? 0) > 0;
  return hasChange ? APP_PAGE_SLUGS.slice() : [];
}
