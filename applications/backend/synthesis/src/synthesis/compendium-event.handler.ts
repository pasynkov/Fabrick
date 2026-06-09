import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { StorageService } from '../storage/storage.service';
import {
  synthesizeCompendiumBundle,
  parseTopicBodies,
  COMPENDIUM_TOPIC_SLUGS,
} from '@app/shared';

const logger = new Logger('CompendiumEventHandler');

interface BundleRef {
  container: string;
  key: string;
  hash: string;
}

interface CompendiumJob {
  type: 'compendium-event';
  jobId: string;
  projectId: string;
  orgSlug: string;
  projectSlug: string;
  bundleRef: BundleRef;
  anthropicApiKey: string;
  callbackToken: string;
}

const PATCH_SYSTEM_PROMPT = `You are a technical documentation synthesizer for the Fabrick platform.
Your task is to produce high-quality compendium documentation from cross-repository dossier content.
The compendium covers four topics: system overview, data flows, transport graph, and infrastructure.
Each topic should be structured with YAML frontmatter followed by Markdown content.`;

export async function handleCompendiumEvent(
  msg: Record<string, unknown>,
  storageService: StorageService,
  apiBaseUrl: string,
): Promise<void> {
  const job = msg as unknown as CompendiumJob;
  const { jobId, bundleRef, anthropicApiKey, callbackToken, orgSlug, projectId } = job;

  // Step 1: Download input bundle
  logger.log(`[${jobId}] downloading input bundle from ${bundleRef.container}/${bundleRef.key}`);
  let bundleBuffer: Buffer;
  try {
    bundleBuffer = await storageService.getObject(bundleRef.container, bundleRef.key);
  } catch (err: any) {
    logger.error(`[${jobId}] failed to download bundle: ${err.message}`);
    return;
  }

  // Step 2: Verify sha256
  const actualHash = createHash('sha256').update(bundleBuffer).digest('hex');
  if (actualHash !== bundleRef.hash) {
    logger.error(`[${jobId}] hash mismatch: expected ${bundleRef.hash}, got ${actualHash}`);
    return;
  }

  const bundle = JSON.parse(bundleBuffer.toString('utf-8'));
  logger.log(`[${jobId}] bundle verified, running LLM calls`);

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const currentCompendiumText = bundle.currentCompendium
    ? JSON.stringify(bundle.currentCompendium, null, 2)
    : 'No existing compendium.';

  const dossiersText = Object.entries(bundle.currentDossiers as Record<string, any>)
    .map(([slug, data]) => `### Repository: ${slug}\n${JSON.stringify(data, null, 2)}`)
    .join('\n\n');

  const userInputText = `Project ID: ${bundle.projectId}\nDossier Updated ID: ${bundle.dossierUpdatedId}\n\nCurrent Compendium:\n${currentCompendiumText}\n\nCurrent Dossiers:\n${dossiersText}`;

  // Step 3: Sonnet patch-compute call
  let patchInstructions = '';
  let patchMeta = { model: 'claude-sonnet-4-5', inputTokens: 0, outputTokens: 0, costUsd: 0 };
  try {
    const patchResp = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: PATCH_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Generate patch instructions (patch.md format) describing what changes are needed to the compendium based on the updated dossiers.\n\n${userInputText}`,
        },
      ],
    });
    patchInstructions = patchResp.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('\n');
    patchMeta = {
      model: patchResp.model,
      inputTokens: patchResp.usage.input_tokens,
      outputTokens: patchResp.usage.output_tokens,
      costUsd: estimateCost(patchResp.model, patchResp.usage.input_tokens, patchResp.usage.output_tokens),
    };
    logger.log(`[${jobId}] patch-compute done, ${patchMeta.outputTokens} output tokens`);
  } catch (err: any) {
    logger.error(`[${jobId}] patch-compute failed: ${err.message}`);
    return;
  }

  // Step 4: Sonnet regen-compute — uses shared helper, all 5 slugs including 'index'
  const topicSlugs = COMPENDIUM_TOPIC_SLUGS; // ['system', 'data-flows', 'transport-graph', 'infra', 'index']
  // Only the four core topic slugs are used for the Haiku description diff (index is omitted to avoid noise).
  const descriptionSlugs = ['system', 'data-flows', 'transport-graph', 'infra'];

  let regenBodies: Record<string, string> = {};
  let regenMeta = { model: 'claude-sonnet-4-5', inputTokens: 0, outputTokens: 0, costUsd: 0 };
  try {
    const regenResult = await synthesizeCompendiumBundle({
      bundle,
      patchInstructions,
      anthropicApiKey,
    });
    regenBodies = regenResult.regenBodies;
    regenMeta = regenResult.meta;
    logger.log(`[${jobId}] regen-compute done, ${regenMeta.outputTokens} output tokens`);
  } catch (err: any) {
    logger.error(`[${jobId}] regen-compute failed: ${err.message}`);
    return;
  }

  // Step 5: Haiku description call (only four topic slugs, no index)
  let descriptionTitle = 'Compendium updated';
  let descMeta = { model: 'claude-haiku-4-5', inputTokens: 0, outputTokens: 0, costUsd: 0 };
  try {
    const oldBodies = bundle.currentCompendium?.pages
      ? Object.fromEntries(bundle.currentCompendium.pages.map((p: any) => [p.slug, p.content]))
      : {};
    // Use only the four core topic slugs for the description diff; exclude index.
    const diffText = descriptionSlugs.map((slug) => {
      const oldContent = (oldBodies[slug] || '').slice(0, 500);
      const newContent = (regenBodies[slug] || '').slice(0, 500);
      return `### ${slug}\nOLD:\n${oldContent}\nNEW:\n${newContent}`;
    }).join('\n\n');

    const haikuResp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 128,
      system: 'You write one-sentence titles (≤ 30 words) for compendium updates, referencing concrete identifiers.',
      messages: [
        {
          role: 'user',
          content: `Write a one-sentence title describing this compendium update:\n${diffText}`,
        },
      ],
    });
    descriptionTitle = haikuResp.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join(' ')
      .trim()
      .slice(0, 200);
    descMeta = {
      model: haikuResp.model,
      inputTokens: haikuResp.usage.input_tokens,
      outputTokens: haikuResp.usage.output_tokens,
      costUsd: estimateCost(haikuResp.model, haikuResp.usage.input_tokens, haikuResp.usage.output_tokens),
    };
    logger.log(`[${jobId}] haiku description done: "${descriptionTitle}"`);
  } catch (err: any) {
    logger.warn(`[${jobId}] haiku description failed (non-fatal): ${err.message}`);
  }

  // Step 6: Record token usage
  try {
    await fetch(`${apiBaseUrl}/v1/internal/synthesis/token-usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        callbackToken,
        inputTokens: patchMeta.inputTokens + regenMeta.inputTokens + descMeta.inputTokens,
        outputTokens: patchMeta.outputTokens + regenMeta.outputTokens + descMeta.outputTokens,
        operation: 'compendium',
      }),
    });
  } catch (err: any) {
    logger.warn(`[${jobId}] token-usage recording failed (non-fatal): ${err.message}`);
  }

  // Assemble finalCompendium pages — all 5 slugs including index, each with sources: [], related: []
  const finalPages = topicSlugs.map((slug) => ({
    slug,
    title: extractTitle(regenBodies[slug] || '', slug),
    content: regenBodies[slug] || `---\ntitle: ${slug}\n---\n`,
    sources: [],
    related: [],
  }));

  // Step 7: Assemble result bundle and upload
  const resultBundle = {
    jobId,
    projectId,
    patchComputed: { instructions: patchInstructions, meta: patchMeta },
    regenApplied: { bodies: regenBodies, meta: regenMeta },
    described: { title: descriptionTitle, meta: descMeta },
    finalCompendium: { pages: finalPages },
  };

  const resultJson = JSON.stringify(resultBundle);
  const resultHash = createHash('sha256').update(resultJson).digest('hex');
  const resultKey = `compendium-jobs/${jobId}-${resultHash}.result.json`;

  try {
    await storageService.putObject(bundleRef.container, resultKey, Buffer.from(resultJson));
    logger.log(`[${jobId}] result bundle uploaded to ${bundleRef.container}/${resultKey}`);
  } catch (err: any) {
    logger.error(`[${jobId}] result bundle upload failed: ${err.message}`);
    return;
  }

  // Step 8: HTTP callback
  const callbackBody = {
    jobId,
    resultBundleRef: { container: bundleRef.container, key: resultKey, hash: resultHash },
  };

  try {
    const callbackRes = await fetch(`${apiBaseUrl}/v2/internal/compendium/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${callbackToken}`,
      },
      body: JSON.stringify(callbackBody),
    });
    if (!callbackRes.ok) {
      const body = await callbackRes.text();
      logger.error(`[${jobId}] callback failed: HTTP ${callbackRes.status} ${body}`);
    } else {
      logger.log(`[${jobId}] callback succeeded`);
    }
  } catch (err: any) {
    logger.error(`[${jobId}] callback error: ${err.message}`);
  }
}

function extractTitle(content: string, fallback: string): string {
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = content.slice(3, end);
      const match = yaml.match(/^title:\s*(.+)$/m);
      if (match) return match[1].trim();
    }
  }
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return fallback;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-5': { input: 3, output: 15 },
    'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  };
  const modelKey = Object.keys(costs).find((k) => model.includes(k.replace('claude-', ''))) || 'claude-sonnet-4-5';
  const rates = costs[modelKey] || costs['claude-sonnet-4-5'];
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}
