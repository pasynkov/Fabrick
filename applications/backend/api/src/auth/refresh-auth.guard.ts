import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const REFRESH_SECRET = () => process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-change-me';

@Injectable()
export class RefreshAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const body = request.body as { refresh_token?: string };
    if (!body?.refresh_token) throw new UnauthorizedException('refresh_token required');

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string; type: string }>(
        body.refresh_token,
        { secret: REFRESH_SECRET() },
      );
      if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
      request.refreshPayload = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
