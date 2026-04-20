import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { CliToken } from '../entities/cli-token.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(CliToken) private readonly cliTokenRepo: Repository<CliToken>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = authHeader.slice(7);

    // Try JWT
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token);
      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) throw new Error('user not found');
      request.user = { id: user.id, email: user.email };
      return true;
    } catch {
      // fall through to CLI token
    }

    // Try CLI token
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.cliTokenRepo.findOne({ where: { tokenHash } });
    if (!record) throw new UnauthorizedException();
    const user = await this.userRepo.findOne({ where: { id: record.userId } });
    if (!user) throw new UnauthorizedException();
    request.user = { id: user.id, email: user.email };
    return true;
  }
}
