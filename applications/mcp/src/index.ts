#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { decode } from 'jsonwebtoken';
import { getSynthesisFile } from './api-client.js';

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

const server = new Server(
  { name: 'fabrick', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_synthesis_index',
      description: 'Get the synthesis index for the current project. Always call this first to understand what files are available.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_synthesis_file',
      description: 'Get a specific synthesis file by path (e.g. "apps/backend.md", "cross-cutting/envs.md").',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to synthesis root' },
        },
        required: ['path'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_synthesis_index') {
    try {
      const text = await getSynthesisFile(apiUrl!, org, project, 'index.md', token!);
      return { content: [{ type: 'text', text }] };
    } catch {
      return { content: [{ type: 'text', text: `Synthesis not available for project '${project}'. Run synthesis first.` }] };
    }
  }

  if (name === 'get_synthesis_file') {
    const path = (args as Record<string, unknown>)?.path as string | undefined;
    if (!path) return { content: [{ type: 'text', text: 'Error: path argument is required' }] };
    try {
      const text = await getSynthesisFile(apiUrl!, org, project, path, token!);
      return { content: [{ type: 'text', text }] };
    } catch {
      return { content: [{ type: 'text', text: `File '${path}' not found in synthesis for project '${project}'.` }] };
    }
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
