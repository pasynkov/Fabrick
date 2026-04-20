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
import { JwtAuthGuard } from './jwt-auth.guard';

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

  @Post('cli-token')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  async cliToken(@Request() req: { user: { id: string } }) {
    return this.authService.issueCliToken(req.user.id);
  }
}
