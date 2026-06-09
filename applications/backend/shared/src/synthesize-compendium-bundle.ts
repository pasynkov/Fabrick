/**
 * Shared helper: runs the Sonnet regen-compute step to produce 5 compendium topic bodies
 * from an input bundle. Used by both the worker handler (3-step path) and the sandbox
 * endpoint (single synchronous call, no patch step).
 *
 * The worker calls this after its patch-compute step (passing patchInstructions).
 * The sandbox calls this with an empty patchInstructions string (no prior patch step).
 */
import Anthropic from '@anthropic-ai/sdk';

const COMPENDIUM_SYSTEM_PROMPT = `You are a technical documentation synthesizer for the Fabrick platform.
Your task is to produce high-quality compendium documentation from cross-repository dossier content.
The compendium covers five topics: system overview, data flows, transport graph, infrastructure, and index.
Each topic should be structured with YAML frontmatter followed by Markdown content.
The index topic is a table-of-contents page that links the four core topics and lists all repositories with their scopes.`;

export const COMPENDIUM_TOPIC_SLUGS = ['system', 'data-flows', 'transport-graph', 'infra', 'index'];

export interface SynthesizeCompendiumBundleInput {
  bundle: {
    projectId: string;
    dossierUpdatedId?: string;
    currentCompendium: any | null;
    currentDossiers: Record<string, any>;
    repos?: Array<{ slug: string; name: string; scopes: string[] }>;
  };
  patchInstructions: string;
  anthropicApiKey: string;
}

export interface SynthesizeCompendiumBundleResult {
  regenBodies: Record<string, string>;
  meta: { model: string; inputTokens: number; outputTokens: number; costUsd: number };
}

export function parseTopicBodies(text: string, slugs: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const marker = `## TOPIC: ${slug}`;
    const start = text.indexOf(marker);
    if (start === -1) {
      result[slug] = `---\ntitle: ${slug}\n---\n\nContent not generated.\n`;
      continue;
    }
    const contentStart = start + marker.length;
    let end = text.length;
    for (let j = i + 1; j < slugs.length; j++) {
      const nextMarker = `## TOPIC: ${slugs[j]}`;
      const nextStart = text.indexOf(nextMarker, contentStart);
      if (nextStart !== -1) {
        end = nextStart;
        break;
      }
    }
    result[slug] = text.slice(contentStart, end).trim();
  }
  return result;
}

export async function synthesizeCompendiumBundle(
  input: SynthesizeCompendiumBundleInput,
): Promise<SynthesizeCompendiumBundleResult> {
  const { bundle, patchInstructions, anthropicApiKey } = input;

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const currentCompendiumText = bundle.currentCompendium
    ? JSON.stringify(bundle.currentCompendium, null, 2)
    : 'No existing compendium.';

  const dossiersText = Object.entries(bundle.currentDossiers as Record<string, any>)
    .map(([slug, data]) => `### Repository: ${slug}\n${JSON.stringify(data, null, 2)}`)
    .join('\n\n');

  const userInputText = `Project ID: ${bundle.projectId}\n\nCurrent Compendium:\n${currentCompendiumText}\n\nCurrent Dossiers:\n${dossiersText}`;

  const reposContext = bundle.repos
    ? bundle.repos
        .map((r) => `- **${r.name}** (\`${r.slug}\`): scopes: ${r.scopes.length > 0 ? r.scopes.join(', ') : '(none)'}`)
        .join('\n')
    : '(no repo context available)';

  const patchSection = patchInstructions
    ? `Apply these patch instructions:\n${patchInstructions}\n\n`
    : '';

  const regenResp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: COMPENDIUM_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Generate fresh compendium content for five topics: system, data-flows, transport-graph, infra, index.
For each topic, output a section starting with "## TOPIC: <slug>" followed by the YAML frontmatter (between --- delimiters) and Markdown content.

For the "index" topic, write a table-of-contents page with:
- A "## Topics" section listing the four topic slugs (system, data-flows, transport-graph, infra) with one-line descriptions and links.
- A "## Repositories" section listing each repository from the repos context below, with: slug, name, one-paragraph description derived from the dossier content, and a bullet list of its scopes (scope name + one-line summary). If the repos list is empty, omit this section.

Repositories context:
${reposContext}

${patchSection}Based on this context:\n${userInputText}`,
      },
    ],
  });

  const regenText = regenResp.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('\n');

  const regenBodies = parseTopicBodies(regenText, COMPENDIUM_TOPIC_SLUGS);

  const meta = {
    model: regenResp.model,
    inputTokens: regenResp.usage.input_tokens,
    outputTokens: regenResp.usage.output_tokens,
    costUsd: estimateCost(regenResp.model, regenResp.usage.input_tokens, regenResp.usage.output_tokens),
  };

  return { regenBodies, meta };
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-5': { input: 3, output: 15 },
    'claude-sonnet-4-6': { input: 3, output: 15 },
    'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  };
  const modelKey = Object.keys(costs).find((k) => model.includes(k.replace('claude-', ''))) || 'claude-sonnet-4-6';
  const rates = costs[modelKey] || costs['claude-sonnet-4-6'];
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}
