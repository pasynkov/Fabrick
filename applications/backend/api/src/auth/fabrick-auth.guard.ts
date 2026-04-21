import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class FabrickAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();

    const raw = authHeader.slice(7);
    const token = raw.startsWith('fbrk_') ? raw.slice(5) : raw;

    try {
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        type: string;
        org?: string;
        project?: string;
        repo?: string;
      }>(token);
      request.user = {
        id: payload.sub,
        email: payload.email,
        type: payload.type,
        org: payload.org,
        project: payload.project,
        repo: payload.repo,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
