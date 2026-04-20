import { Injectable, Logger } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(private readonly minioService: MinioService) {}

  createServer(orgSlug: string, projectSlug: string): Server {
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
              path: { type: 'string', description: 'File path relative to synthesis root (e.g. "apps/backend.md")' },
            },
            required: ['path'],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.logger.log(`[${orgSlug}/${projectSlug}] tool call: ${name}`);

      if (name === 'get_synthesis_index') {
        const text = await this.readSynthesisFile(orgSlug, projectSlug, 'index.md');
        return { content: [{ type: 'text', text }] };
      }

      if (name === 'get_synthesis_file') {
        const path = (args as any)?.path as string;
        if (!path) return { content: [{ type: 'text', text: 'Error: path argument is required' }] };
        const text = await this.readSynthesisFile(orgSlug, projectSlug, path);
        return { content: [{ type: 'text', text }] };
      }

      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    });

    return server;
  }

  private async readSynthesisFile(orgSlug: string, projectSlug: string, path: string): Promise<string> {
    const key = `${projectSlug}/synthesis/${path}`;
    try {
      const buf = await this.minioService.getObject(orgSlug, key);
      return buf.toString('utf-8');
    } catch (err: any) {
      if (path === 'index.md') {
        return `Synthesis not available for project '${projectSlug}'. Run synthesis first.`;
      }
      return `File '${path}' not found in synthesis for project '${projectSlug}'.`;
    }
  }
}
