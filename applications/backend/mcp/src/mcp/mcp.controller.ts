import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';
import { TokenValidatorService } from '../auth/token-validator.service';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly tokenValidator: TokenValidatorService,
  ) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const org = (req.headers['x-fabrick-org'] as string) || '';
    const project = (req.headers['x-fabrick-project'] as string) || '';

    this.logger.log(`MCP request org=${org} project=${project} method=${req.method}`);

    const valid = await this.tokenValidator.validate(token);
    if (!valid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!org || !project) {
      res.status(400).json({ error: 'X-Fabrick-Org and X-Fabrick-Project headers are required' });
      return;
    }

    const server = this.mcpService.createServer(org, project);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => transport.close());

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
