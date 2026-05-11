#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { decode } from 'jsonwebtoken';
import { searchProject, getSynthesisPage } from './api-client.js';

const token = process.env.FABRICK_TOKEN;
const apiUrl = process.env.FABRICK_API_URL;

if (!token) {
  process.stderr.write('Error: FABRICK_TOKEN env var is required\n');
  process.exit(1);
}
if (!apiUrl) {
  process.stderr.write('Error: FABRICK_API_URL env var is required\n');
  process.exit(1);
}

const raw = token.startsWith('fbrk_') ? token.slice(5) : token;
const payload = decode(raw) as Record<string, unknown> | null;

if (!payload || typeof payload.org !== 'string' || typeof payload.project !== 'string') {
  process.stderr.write('Error: FABRICK_TOKEN must contain org and project claims\n');
  process.exit(1);
}

const org = payload.org;
const project = payload.project;

const FALLBACK_DESCRIPTION = 'Search the project knowledge base. Ask any question about architecture, APIs, entities, flows, configuration.';
const FALLBACK_INSTRUCTIONS = `Use fabrick_search when your question requires knowledge from a different service, layer, or repository than the one you are currently working in. Do not use it for questions answerable from local file context.`;

const [toolDescription, serverInstructions] = await Promise.allSettled([
  getSynthesisPage(apiUrl, org, project, 'mcp-description', token),
  getSynthesisPage(apiUrl, org, project, 'mcp-instructions', token),
]);

const server = new Server(
  { name: 'fabrick', version: '1.0.0' },
  {
    capabilities: { tools: {} },
    instructions: serverInstructions.status === 'fulfilled' ? serverInstructions.value : FALLBACK_INSTRUCTIONS,
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'fabrick_search',
      description: toolDescription.status === 'fulfilled' ? toolDescription.value : FALLBACK_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Your question about the project' },
        },
        required: ['question'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'fabrick_search') {
    const question = (args as Record<string, unknown>)?.question as string | undefined;
    if (!question) return { content: [{ type: 'text', text: 'Error: question argument is required' }] };
    try {
      const result = await searchProject(apiUrl!, org, project, question, token!);
      const sourcesText = result.sources.length > 0 ? `\n\n**Sources:** ${result.sources.join(', ')}` : '';
      return { content: [{ type: 'text', text: result.answer + sourcesText }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Search failed: ${err?.message ?? 'Unknown error'}` }] };
    }
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
