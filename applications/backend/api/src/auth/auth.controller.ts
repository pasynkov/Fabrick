import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { FabrickAuthGuard } from './fabrick-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshAuthGuard } from './refresh-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password || body.password.length < 8) {
      throw new BadRequestException('email and password (min 8 chars) required');
    }
    return this.authService.register(body.email, body.password);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(RefreshAuthGuard)
  async refresh(@Body() body: { refresh_token: string }) {
    return this.authService.refresh(body.refresh_token);
  }

  @Post('revoke')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async revoke() {
    return this.authService.revoke();
  }

  @Post('cli-token')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  async cliToken(@Request() req: { user: { id: string } }) {
    return this.authService.issueCliToken(req.user.id);
  }

  @Post('mcp-token')
  @HttpCode(201)
  @UseGuards(FabrickAuthGuard)
  async mcpToken(
    @Request() req: { user: { id: string } },
    @Body() body: { orgSlug: string; projectSlug: string; repoId: string },
  ) {
    if (!body.orgSlug || !body.projectSlug || !body.repoId) {
      throw new BadRequestException('orgSlug, projectSlug, and repoId are required');
    }
    return this.authService.issueMcpToken(req.user.id, body.orgSlug, body.projectSlug, body.repoId);
  }
}
